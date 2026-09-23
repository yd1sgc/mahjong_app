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
  console.log('=== 修復シミュレーション（Dry Run） ===');

  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?select=*,round_seats(*)&order=game_id.asc,round_index.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();

  const toUpdate = [];

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
        // ツモ局でリーチしていた非和了者の供託漏れ: kyotaku を -1000 に修復し、base_point を正しく調整
        if (r.result_type === 'tsumo' && s.is_riichi === 1 && s.is_winner === 0 && kyotaku === 0 && (delta - sum) === -1000) {
          const newKyotaku = -1000;
          // score_delta = newBase + honba + newKyotaku => newBase = score_delta - honba - newKyotaku
          const newBase = delta - honba - newKyotaku;
          const newSum = newBase + honba + newKyotaku + penalty;

          toUpdate.push({
            round_id: s.round_id,
            seat: s.seat,
            old: { base, honba, kyotaku, penalty, delta, sum },
            fixed: { base_point: newBase, honba_point: honba, kyotaku_point: newKyotaku, penalty_point: penalty, score_delta: delta, newSum },
          });
        } else {
          console.warn(`想定外の不整合: round_id=${s.round_id}, seat=${s.seat}`);
        }
      }
    }
  }

  console.log(`修復対象レコード数: ${toUpdate.length} 件`);
  let allMatched = true;
  for (const u of toUpdate) {
    if (u.fixed.newSum !== u.fixed.score_delta) {
      allMatched = false;
      console.error('修復後も不整合:', u);
    }
  }

  if (allMatched) {
    console.log(`検証完了: 全 ${toUpdate.length} 件が修復後に sum === score_delta と一致します。`);
  }
}

run().catch((e) => console.error(e));
