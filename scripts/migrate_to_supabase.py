import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

# 1. .env.local の読み込み
env_path = os.path.join(os.getcwd(), '.env.local')
if not os.path.exists(env_path):
    print("Error: .env.local が見つかりません。")
    sys.exit(1)

env = {}
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

SUPABASE_URL = env.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL または SUPABASE_KEY が設定されていません。")
    sys.exit(1)

LOCAL_DB_PATH = os.path.abspath(os.path.join(os.getcwd(), '..', 'mahjong_personal', 'local_mahjong_v2_new.db'))
if not os.path.exists(LOCAL_DB_PATH):
    print(f"Error: ローカルDBが見つかりません: {LOCAL_DB_PATH}")
    sys.exit(1)

print("=== データ移行開始 (PC ローカルDB -> 新Supabase) ===")
print(f"Source DB: {LOCAL_DB_PATH} (mode=ro)")
print(f"Target Supabase: {SUPABASE_URL}\n")

# 2. REST API ヘルパー関数
def post_supabase(table, records, on_conflict=None):
    if not records:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    # バッチ分割送信 (100件ずつ)
    batch_size = 100
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        data = json.dumps(batch, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as res:
                if res.status not in (200, 201):
                    print(f"Warning: {table} バッチ {i} ステータス: {res.status}")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            raise RuntimeError(f"Supabaseへの挿入エラー ({table}): HTTP {e.code} - {err_body}")

# 3. ローカルDBからデータ抽出（mode=ro で物理的読み取り専用接続）
conn = sqlite3.connect(f"file:{LOCAL_DB_PATH}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row
c = conn.cursor()

try:
    # 1. members
    c.execute("SELECT member_id, member_name, is_guest, is_archived, created_at FROM members")
    members = [dict(r) for r in c.fetchall()]
    print(f"[1/7] members: {len(members)} 件抽出")
    post_supabase("members", members)
    print("      -> Supabaseへ登録完了")

    # 2. groups
    c.execute("SELECT group_id, display_id, group_name, default_rule_id, is_archived FROM groups")
    groups = [dict(r) for r in c.fetchall()]
    print(f"[2/7] groups: {len(groups)} 件抽出")
    post_supabase("groups", groups)
    print("      -> Supabaseへ登録完了")

    # 3. group_memberships
    c.execute("SELECT group_id, member_id, joined_at FROM group_memberships")
    memberships = [dict(r) for r in c.fetchall()]
    print(f"[3/7] group_memberships: {len(memberships)} 件抽出")
    post_supabase("group_memberships", memberships)
    print("      -> Supabaseへ登録完了")

    # 4. rule_templates
    c.execute("SELECT rule_id, name, kind, version, config_json, is_archived FROM rule_templates")
    rules = []
    for r in c.fetchall():
        d = dict(r)
        if isinstance(d["config_json"], str):
            try:
                d["config_json"] = json.loads(d["config_json"])
            except Exception:
                pass
        rules.append(d)
    print(f"[4/7] rule_templates: {len(rules)} 件抽出")
    post_supabase("rule_templates", rules)
    print("      -> Supabaseへ登録完了")

    # 5. games (sync_target = 1 の27件のみ厳格に抽出)
    c.execute("""
        SELECT game_id, played_at, group_id, rule_name_snapshot, rule_config_snapshot,
               game_mode, sync_target, 1 as is_synced
        FROM games
        WHERE sync_target = 1
        ORDER BY played_at ASC
    """)
    games = []
    target_game_ids = []
    for r in c.fetchall():
        d = dict(r)
        target_game_ids.append(d["game_id"])
        if isinstance(d["rule_config_snapshot"], str):
            try:
                d["rule_config_snapshot"] = json.loads(d["rule_config_snapshot"])
            except Exception:
                pass
        games.append(d)
    print(f"[5/7] games (sync_target=1): {len(games)} 件抽出")
    post_supabase("games", games)
    print("      -> Supabaseへ登録完了")

    if not target_game_ids:
        print("同期対象ゲームが存在しません。終了します。")
        sys.exit(0)

    # 6. game_participants (該当27件の参加者データ)
    ph = ",".join(["?"] * len(target_game_ids))
    c.execute(f"""
        SELECT game_id, seat, member_id, player_name_snapshot, final_score, rank, point, was_group_member
        FROM game_participants
        WHERE game_id IN ({ph})
        ORDER BY game_id, seat
    """, target_game_ids)
    participants = [dict(r) for r in c.fetchall()]
    print(f"[6/7] game_participants: {len(participants)} 件抽出")
    post_supabase("game_participants", participants)
    print("      -> Supabaseへ登録完了")

    # 7. rounds & round_seats (該当27件の局データ)
    c.execute(f"""
        SELECT round_id, game_id, round_index, kyoku_name, honba, riichi_sticks, result_type
        FROM rounds
        WHERE game_id IN ({ph})
        ORDER BY game_id, round_index
    """, target_game_ids)
    rounds = [dict(r) for r in c.fetchall()]
    target_round_ids = [r["round_id"] for r in rounds]
    print(f"[7/7] rounds: {len(rounds)} 件抽出")
    post_supabase("rounds", rounds)
    print("      -> Supabaseへ登録完了")

    if target_round_ids:
        r_ph = ",".join(["?"] * len(target_round_ids))
        c.execute(f"""
            SELECT round_id, seat, member_id, base_point, honba_point, kyotaku_point,
                   penalty_point, score_delta, chip_delta, han, fu,
                   is_winner, is_loser, is_riichi, is_furo, is_tenpai
            FROM round_seats
            WHERE round_id IN ({r_ph})
            ORDER BY round_id, seat
        """, target_round_ids)
        seats = [dict(r) for r in c.fetchall()]
        print(f"      round_seats: {len(seats)} 件抽出")
        post_supabase("round_seats", seats)
        print("      -> Supabaseへ登録完了")

    print("\n=== 全件インポート完了 ===")

except Exception as e:
    print(f"\nエラーが発生しました: {e}")
    sys.exit(1)
finally:
    conn.close()

# 4. 突合検証の実行
print("\n=== 突合検証 (SQLite sync_target=1 vs Supabase) ===")
def fetch_supabase(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode('utf-8'))

sb_games = fetch_supabase("games?select=game_id,played_at")
sb_participants = fetch_supabase("game_participants?select=game_id,seat,final_score,point")
sb_rounds = fetch_supabase("rounds?select=round_id")

print(f"Games 件数: SQLite={len(games)}, Supabase={len(sb_games)} -> {'一致 [PASS]' if len(games) == len(sb_games) else '不一致 [FAIL]'}")
print(f"Participants 件数: SQLite={len(participants)}, Supabase={len(sb_participants)} -> {'一致 [PASS]' if len(participants) == len(sb_participants) else '不一致 [FAIL]'}")
print(f"Rounds 件数: SQLite={len(rounds)}, Supabase={len(sb_rounds)} -> {'一致 [PASS]' if len(rounds) == len(sb_rounds) else '不一致 [FAIL]'}")

# スコア・ポイント合計突合
sqlite_total_score = sum(p["final_score"] for p in participants)
sqlite_total_point = round(sum(p["point"] for p in participants), 1)

sb_total_score = sum(p["final_score"] for p in sb_participants)
sb_total_point = round(sum(float(p["point"]) for p in sb_participants), 1)

print(f"総最終素点 (final_score 合計): SQLite={sqlite_total_score}, Supabase={sb_total_score} -> {'一致 [PASS]' if sqlite_total_score == sb_total_score else '不一致 [FAIL]'}")
print(f"総確定ポイント (point 合計): SQLite={sqlite_total_point}, Supabase={sb_total_point} -> {'一致 [PASS]' if abs(sqlite_total_point - sb_total_point) < 1e-4 else '不一致 [FAIL]'}")
