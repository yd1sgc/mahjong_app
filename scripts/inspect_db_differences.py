import os
import sys
import json
import sqlite3
import urllib.request
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# 1. .env.local 読み込み
env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

sb_url = env['NEXT_PUBLIC_SUPABASE_URL']
sb_key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

def fetch_sb(endpoint):
    url = f"{sb_url}/rest/v1/{endpoint}"
    req = urllib.request.Request(url, headers={
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}"
    })
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode('utf-8'))

# 2. SQLite データ取得
local_db = os.path.abspath(os.path.join('..', 'mahjong_personal', 'local_mahjong_v2_new.db'))
conn = sqlite3.connect(f"file:{local_db}?mode=ro", uri=True)
c = conn.cursor()

c.execute("SELECT game_id, played_at, rule_name_snapshot, sync_target, is_synced FROM games")
sqlite_games = {r[0]: {"played_at": r[1], "rule": r[2], "sync_target": r[3], "is_synced": r[4]} for r in c.fetchall()}

c.execute("SELECT game_id, seat, member_id, player_name_snapshot, final_score, rank, point FROM game_participants")
sqlite_parts = defaultdict(list)
for r in c.fetchall():
    sqlite_parts[r[0]].append({
        "seat": r[1], "member_id": r[2], "name": r[3], "score": r[4], "rank": r[5], "point": r[6]
    })

c.execute("SELECT COUNT(*) FROM rounds")
sqlite_rounds_count = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM round_seats")
sqlite_seats_count = c.fetchone()[0]

c.execute("""
    SELECT COUNT(*) FROM round_seats
    WHERE (base_point + honba_point + kyotaku_point + penalty_point) != score_delta
""")
sqlite_broken_seats = c.fetchone()[0]

c.execute("SELECT rule_id, name, is_archived FROM rule_templates")
sqlite_rules = {r[0]: {"name": r[1], "archived": r[2]} for r in c.fetchall()}

conn.close()

# 3. Supabase データ取得
sb_games_raw = fetch_sb("games?select=game_id,played_at,rule_name_snapshot,status,sync_target,is_synced&order=played_at.desc")
sb_games = {g["game_id"]: g for g in sb_games_raw}

sb_parts_raw = fetch_sb("game_participants?select=game_id,seat,member_id,player_name_snapshot,final_score,rank,point")
sb_parts = defaultdict(list)
for p in sb_parts_raw:
    sb_parts[p["game_id"]].append(p)

sb_rounds_raw = fetch_sb("rounds?select=round_id")
sb_rounds_count = len(sb_rounds_raw)

# round_seats の取得は1000件超の可能性があるためページネーション
sb_seats = []
offset = 0
while True:
    rows = fetch_sb(f"round_seats?select=round_id,base_point,honba_point,kyotaku_point,penalty_point,score_delta&limit=1000&offset={offset}")
    if not rows:
        break
    sb_seats.extend(rows)
    if len(rows) < 1000:
        break
    offset += 1000

sb_seats_count = len(sb_seats)
sb_broken_seats = sum(1 for s in sb_seats if (s.get("base_point", 0) + s.get("honba_point", 0) + s.get("kyotaku_point", 0) + s.get("penalty_point", 0)) != s.get("score_delta", 0))

sb_rules_raw = fetch_sb("rule_templates?select=rule_id,name,is_archived")
sb_rules = {r["rule_id"]: r for r in sb_rules_raw}

# 4. 分析出力
print("=== 1. 対局数・レコード数 全体サマリー ===")
print(f"対局数 (games)      : SQLite = {len(sqlite_games)} 件  |  Supabase = {len(sb_games)} 件")
print(f"局数 (rounds)       : SQLite = {sqlite_rounds_count} 件  |  Supabase = {sb_rounds_count} 件")
print(f"局座席数 (seats)    : SQLite = {sqlite_seats_count} 件  |  Supabase = {sb_seats_count} 件")
print(f"内訳不整合座席数    : SQLite = {sqlite_broken_seats} 件  |  Supabase = {sb_broken_seats} 件")

# 5. ID 突合
sq_ids = set(sqlite_games.keys())
sb_ids = set(sb_games.keys())

only_sb = sb_ids - sq_ids
only_sq = sq_ids - sb_ids
common_ids = sq_ids & sb_ids

print(f"\n共通対局数          : {len(common_ids)} 件")
print(f"Supabase のみに存在 : {len(only_sb)} 件")
print(f"SQLite のみに存在   : {len(only_sq)} 件")

if only_sb:
    print("\n--- [Supabase のみに存在する対局] ---")
    for gid in sorted(only_sb):
        g = sb_games[gid]
        parts = sb_parts.get(gid, [])
        names = "/".join(p["player_name_snapshot"] for p in sorted(parts, key=lambda x: x["seat"]))
        print(f"ID: {gid[:8]}.. | 日時: {g.get('played_at')} | 状態: {g.get('status')} | ルール: {g.get('rule_name_snapshot')} | メンバー: {names}")

if only_sq:
    print("\n--- [SQLite のみに存在する対局] ---")
    for gid in sorted(only_sq):
        g = sqlite_games[gid]
        parts = sqlite_parts.get(gid, [])
        names = "/".join(p["name"] for p in sorted(parts, key=lambda x: x["seat"]))
        print(f"ID: {gid[:8]}.. | 日時: {g.get('played_at')} | sync_target: {g.get('sync_target')} | is_synced: {g.get('is_synced')} | メンバー: {names}")

# 6. 共通対局のデータ差分チェック
diff_count = 0
print("\n--- [共通対局のデータ内容差分チェック] ---")
for gid in common_ids:
    p_sq = sorted(sqlite_parts[gid], key=lambda x: x["seat"])
    p_sb = sorted(sb_parts[gid], key=lambda x: x["seat"])
    
    has_diff = False
    diff_details = []
    if len(p_sq) != len(p_sb):
        has_diff = True
        diff_details.append(f"参加者数不一致 (sq={len(p_sq)}, sb={len(p_sb)})")
    else:
        for sq_row, sb_row in zip(p_sq, p_sb):
            if sq_row["name"] != sb_row["player_name_snapshot"] or \
               sq_row["score"] != sb_row["final_score"] or \
               abs(sq_row["point"] - float(sb_row["point"])) > 0.01:
                has_diff = True
                diff_details.append(f"席{sq_row['seat']}: {sq_row['name']}(sq:{sq_row['score']}点/{sq_row['point']}pt) vs {sb_row['player_name_snapshot']}(sb:{sb_row['final_score']}点/{sb_row['point']}pt)")
    
    if has_diff:
        diff_count += 1
        print(f"対局 ID: {gid[:8]}.. (日時: {sqlite_games[gid]['played_at']})")
        for d in diff_details:
            print(f"  - {d}")

if diff_count == 0:
    print("共通対局（27件）の参加者名・素点・pt は完全に一致しています。")
else:
    print(f"共通対局のうち {diff_count} 件でデータ不一致があります。")

# 7. ルール差分チェック
print("\n--- [ルール定義 (rule_templates) 突合] ---")
all_rule_ids = set(sqlite_rules.keys()) | set(sb_rules.keys())
for rid in all_rule_ids:
    sq_r = sqlite_rules.get(rid)
    sb_r = sb_rules.get(rid)
    sq_name = sq_r["name"] if sq_r else "【なし】"
    sb_name = sb_r["name"] if sb_r else "【なし】"
    match_str = "一致" if sq_name == sb_name else "不一致"
    print(f"Rule ID: {rid:<15} | SQLite: {sq_name:<12} | Supabase: {sb_name:<12} [{match_str}]")
