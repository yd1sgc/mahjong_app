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
  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?select=*,round_seats(*)&order=game_id.asc,round_index.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();

  for (const r of rounds) {
    const seats = r.round_seats || [];
    for (const s of seats) {
      const base = s.base_point || 0;
      const honba = s.honba_point || 0;
      const kyotaku = s.kyotaku_point || 0;
      const penalty = s.penalty_point || 0;
      const delta = s.score_delta || 0;
      const sum = base + honba + kyotaku + penalty;

      if (sum !== delta) {
        console.log(`局: ${r.kyoku_name} ${r.honba}本場, 結果: ${r.result_type}, 供託: ${r.riichi_sticks}本`);
        console.log(`  席${s.seat}: score_delta=${delta}, base=${base}, honba=${honba}, kyotaku=${kyotaku}, penalty=${penalty}, sum=${sum}, diff=${delta - sum}`);
        console.log(`  flags: win=${s.is_winner}, lose=${s.is_loser}, riichi=${s.is_riichi}, furo=${s.is_furo}, tenpai=${s.is_tenpai}`);
      }
    }
  }
}

run().catch((e) => console.error(e));
