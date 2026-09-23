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
const targetGameId = '12382453-c66f-46aa-a0f8-1263eefce5c5';

// 修復対象の4件（computeAllRoundsDetails により確定）
const updates = [
  // 1. 東1局 クロキ (席1)
  {
    kyoku: '東1局',
    player: 'クロキ',
    roundIndex: 0,
    seat: 1,
    patch: {
      score_delta: -1000,
      base_point: 0,
      honba_point: 0,
      kyotaku_point: -1000,
      penalty_point: 0,
    },
  },
  // 2. 東1局 タク (席2)
  {
    kyoku: '東1局',
    player: 'タク',
    roundIndex: 0,
    seat: 2,
    patch: {
      score_delta: 4900,
      base_point: 3900,
      honba_point: 0,
      kyotaku_point: 1000,
      penalty_point: 0,
    },
  },
  // 3. 東2局 ユウダイ (席3)
  {
    kyoku: '東2局',
    player: 'ユウダイ',
    roundIndex: 1,
    seat: 3,
    patch: {
      score_delta: 500,
      base_point: 0,
      honba_point: 0,
      kyotaku_point: -1000,
      penalty_point: 1500,
    },
  },
  // 4. 東4局 アリイ (席4)
  {
    kyoku: '東4局',
    player: 'アリイ',
    roundIndex: 3,
    seat: 4,
    patch: {
      score_delta: 2000,
      base_point: 0,
      honba_point: 0,
      kyotaku_point: -1000,
      penalty_point: 3000,
    },
  },
];

async function run() {
  console.log(`=== 最新テスト対局（${targetGameId}）DB修復実行 ===\n`);

  // rounds を取得して round_id を特定
  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${targetGameId}&order=round_index.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();

  for (const item of updates) {
    const round = rounds.find((r) => r.round_index === item.roundIndex);
    if (!round) {
      console.error(`局が見つかりません: roundIndex=${item.roundIndex}`);
      continue;
    }

    const patchUrl = `${supabaseUrl}/rest/v1/round_seats?round_id=eq.${round.round_id}&seat=eq.${item.seat}`;
    console.log(`PATCH: ${item.kyoku} 席${item.seat} (${item.player})`);
    console.log(`  更新内容:`, JSON.stringify(item.patch));

    const pRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(item.patch),
    });

    if (!pRes.ok) {
      const err = await pRes.text();
      console.error(`  PATCH 失敗: ${pRes.status} ${err}`);
    } else {
      const updated = await pRes.json();
      console.log(`  PATCH 成功:`, updated[0]?.score_delta, 'base:', updated[0]?.base_point, 'kyo:', updated[0]?.kyotaku_point, 'pen:', updated[0]?.penalty_point);
    }
  }

  console.log(`\n全 ${updates.length} 件の修復処理が完了しました。`);
}

run().catch((e) => console.error(e));
