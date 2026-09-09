import os
import sys
import json
import sqlite3
import urllib.request
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# 1. .env.local
env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

# 2. SQLite集計 (sync_target=1)
local_db = os.path.abspath(os.path.join('..', 'mahjong_personal', 'local_mahjong_v2_new.db'))
conn = sqlite3.connect(f"file:{local_db}?mode=ro", uri=True)
c = conn.cursor()
c.execute("""
    SELECT player_name_snapshot, COUNT(*), SUM(point), SUM(final_score)
    FROM game_participants
    WHERE game_id IN (SELECT game_id FROM games WHERE sync_target = 1)
    GROUP BY player_name_snapshot
    ORDER BY COUNT(*) DESC, SUM(point) DESC
""")
sqlite_stats = {r[0]: {"count": r[1], "point": round(r[2], 1), "score": r[3]} for r in c.fetchall()}
conn.close()

# 3. Supabase集計
url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/game_participants?select=player_name_snapshot,point,final_score"
req = urllib.request.Request(url, headers={
    "apikey": env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    "Authorization": f"Bearer {env['NEXT_PUBLIC_SUPABASE_ANON_KEY']}"
})
with urllib.request.urlopen(req) as res:
    sb_rows = json.loads(res.read().decode('utf-8'))

sb_stats = defaultdict(lambda: {"count": 0, "point": 0.0, "score": 0})
for r in sb_rows:
    name = r["player_name_snapshot"]
    sb_stats[name]["count"] += 1
    sb_stats[name]["point"] += float(r["point"])
    sb_stats[name]["score"] += r["final_score"]

for name in sb_stats:
    sb_stats[name]["point"] = round(sb_stats[name]["point"], 1)

print("=== プレイヤー別 成績突合検証 (SQLite vs Supabase) ===")
all_pass = True
for name, sq in sqlite_stats.items():
    sb = sb_stats.get(name)
    if not sb:
        print(f"[FAIL] {name}: Supabaseにデータが存在しません")
        all_pass = False
        continue
    
    cnt_match = sq["count"] == sb["count"]
    pt_match = abs(sq["point"] - sb["point"]) < 1e-4
    sc_match = sq["score"] == sb["score"]
    
    if cnt_match and pt_match and sc_match:
        print(f"[PASS] {name:<8}: 対局数={sq['count']}, pt={sq['point']:>6.1f}, 素点={sq['score']:>8} (完全一致)")
    else:
        print(f"[FAIL] {name:<8}: SQLite={sq} vs Supabase={sb}")
        all_pass = False

print(f"\n突合結果: {'【全プレイヤー完全一致 PASS】' if all_pass else '【不一致あり FAIL】'}")
