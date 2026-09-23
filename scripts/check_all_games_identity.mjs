import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const targetTestGameId = '12382453-c66f-46aa-a0f8-1263eefce5c5';

async function run() {
  const [gamesRes, roundsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/games?select=game_id,created_at,status&order=created_at.asc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/rounds?select=round_id,game_id,round_index,kyoku_name,honba,result_type,round_seats(*)&order=game_id.asc,round_index.asc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    }),
  ]);

  const games = await gamesRes.json();
  const rounds = await roundsRes.json();

  let pastTotalSeats = 0;
  let pastMismatchSeats = 0;
  const gamesWithMismatch = new Set();

  let testTotalSeats = 0;
  let testMismatchSeats = 0;

  for (const r of rounds) {
    const isTestGame = r.game_id === targetTestGameId;
    const seats = r.round_seats || [];

    for (const s of seats) {
      const base = s.base_point || 0;
      const honba = s.honba_point || 0;
      const kyotaku = s.kyotaku_point || 0;
      const penalty = s.penalty_point || 0;
      const delta = s.score_delta || 0;
      const sum = base + honba + kyotaku + penalty;
      const match = sum === delta;

      if (isTestGame) {
        testTotalSeats++;
        if (!match) testMismatchSeats++;
      } else {
        pastTotalSeats++;
        if (!match) {
          pastMismatchSeats++;
          gamesWithMismatch.add(r.game_id);
        }
      }
    }
  }

  console.log('=== 全対局の内訳恒等式（base + honba + kyo + pen === delta）検証結果 ===');
  console.log(`総対局数: ${games.length} 対局`);
  console.log(`\n【過去の対局 (${games.length - 1} 対局)】`);
  console.log(`  総座席数: ${pastTotalSeats} 席`);
  console.log(`  不整合座席数: ${pastMismatchSeats} 席`);
  console.log(`  不整合が存在する対局数: ${gamesWithMismatch.size} 対局`);

  console.log(`\n【今回のテスト対局 (ID: ${targetTestGameId})】`);
  console.log(`  総座席数: ${testTotalSeats} 席`);
  console.log(`  不整合座席数: ${testMismatchSeats} 席 (東1局クロキ, 東1局タク, 東2局ユウダイ, 東4局アリイ)`);
}

run().catch((e) => console.error(e));
