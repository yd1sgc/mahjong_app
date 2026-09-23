import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local が見つかりません。');
  process.exit(1);
}

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
  console.log('=== Supabase 不整合データ修復の実行 ===');

  // 1. 全局および全席データを取得
  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?select=*,round_seats(*)&order=game_id.asc,round_index.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();

  const targets = [];

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
        if (r.result_type === 'tsumo' && s.is_riichi === 1 && s.is_winner === 0 && kyotaku === 0 && (delta - sum) === -1000) {
          const newKyotaku = -1000;
          const newBase = delta - honba - newKyotaku;

          targets.push({
            round_id: s.round_id,
            seat: s.seat,
            member_id: s.member_id,
            updatePayload: {
              base_point: newBase,
              kyotaku_point: newKyotaku,
            },
          });
        }
      }
    }
  }

  console.log(`更新対象: ${targets.length} 件`);
  if (targets.length !== 19) {
    console.error(`警告: 対象件数が想定(19件)と異なります (${targets.length}件)。中断します。`);
    process.exit(1);
  }

  // 2. 1件ずつ安全に更新
  let successCount = 0;
  for (const t of targets) {
    const patchUrl = `${supabaseUrl}/rest/v1/round_seats?round_id=eq.${t.round_id}&seat=eq.${t.seat}`;
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(t.updatePayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`更新失敗: round_id=${t.round_id}, seat=${t.seat}: ${res.status} ${errText}`);
    } else {
      successCount++;
    }
  }

  console.log(`更新完了: ${successCount} / ${targets.length} 件`);

  // 3. 全件再検証
  console.log('\n=== 修復後の再検証 ===');
  const verifyRes = await fetch(`${supabaseUrl}/rest/v1/rounds?select=*,round_seats(*)`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const verifyRounds = await verifyRes.json();

  let remainingMismatch = 0;
  let totalVerified = 0;

  for (const r of verifyRounds) {
    for (const s of (r.round_seats || [])) {
      totalVerified++;
      const base = s.base_point || 0;
      const honba = s.honba_point || 0;
      const kyotaku = s.kyotaku_point || 0;
      const penalty = s.penalty_point || 0;
      const delta = s.score_delta || 0;
      if (base + honba + kyotaku + penalty !== delta) {
        remainingMismatch++;
      }
    }
  }

  console.log(`総席数: ${totalVerified} 件`);
  console.log(`残存不整合件数: ${remainingMismatch} 件`);
  if (remainingMismatch === 0) {
    console.log('★ 全データが 100% 完全整合しました！ ★');
  } else {
    console.error('★ まだ不整合が残っています ★');
  }
}

run().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
