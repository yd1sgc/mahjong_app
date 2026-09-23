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

async function run() {
  // 過去の移行データ（最初の対局）のroundsとseatsを取得
  const gRes = await fetch(`${supabaseUrl}/rest/v1/games?select=*&order=played_at.asc&limit=1`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const game = (await gRes.json())[0];
  console.log(`過去移行対局ID: ${game.game_id}, 日時: ${game.played_at}`);

  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${game.game_id}&select=*,round_seats(*)&order=round_index.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();

  console.log(`局数: ${rounds.length}`);

  for (const r of rounds) {
    const seats = r.round_seats || [];
    const hasRiichi = seats.some((s) => s.is_riichi === 1);
    if (!hasRiichi) continue;

    console.log(`\n第${r.round_index + 1}局【${r.kyoku_name} ${r.honba}本場】結果: ${r.result_type}, 供託: ${r.riichi_sticks}本`);
    let sumDelta = 0;
    for (const s of seats) {
      sumDelta += s.score_delta;
      console.log(`  席${s.seat}: score_delta=${s.score_delta}, base=${s.base_point}, honba=${s.honba_point}, kyotaku=${s.kyotaku_point}, penalty=${s.penalty_point}, winner=${s.is_winner}, riichi=${s.is_riichi}`);
    }
    console.log(`  => score_delta 合計: ${sumDelta}`);
  }
}

run().catch(console.error);
