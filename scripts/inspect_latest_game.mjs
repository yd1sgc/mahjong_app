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
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    env[k] = v;
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  console.log('最新の対局データを取得中...');

  // 1. 最新の games レコード1件
  const gRes = await fetch(`${supabaseUrl}/rest/v1/games?select=*&order=played_at.desc&limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const games = await gRes.json();
  if (!games || games.length === 0) {
    console.log('対局データが見つかりません');
    return;
  }
  const game = games[0];
  console.log(`\n========================================`);
  console.log(`対局ID: ${game.game_id}`);
  console.log(`対局日時: ${game.played_at}`);
  console.log(`ルール: ${game.rule_name_snapshot}`);
  console.log(`ステータス: ${game.status}`);
  console.log(`========================================\n`);

  // 2. 参加者情報
  const pRes = await fetch(`${supabaseUrl}/rest/v1/game_participants?game_id=eq.${game.game_id}&order=seat.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const participants = await pRes.json();
  console.log('--- 参加者 (4名) ---');
  for (const p of participants) {
    console.log(`座席${p.seat}: ${p.player_name_snapshot} (最終素点: ${p.final_score}, 順位: ${p.rank}位, pt: ${p.point})`);
  }

  // 3. 全局情報
  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${game.game_id}&select=*,round_seats(*)&order=round_index.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const rounds = await rRes.json();
  console.log(`\n--- 全局履歴 (全 ${rounds.length} 局) ---`);

  const pNameMap = new Map();
  participants.forEach((p) => pNameMap.set(p.member_id, p.player_name_snapshot));

  let prevScores = {};
  participants.forEach((p) => {
    prevScores[p.player_name_snapshot] = 25000;
  });

  for (const r of rounds) {
    console.log(`\n----------------------------------------`);
    console.log(`第${r.round_index + 1}局: ${r.kyoku_name} ${r.honba}本場 (供託棒: ${r.riichi_sticks}本) 結果: ${r.result_type}`);
    console.log(`局ID: ${r.round_id}`);

    const seats = r.round_seats || [];
    seats.sort((a, b) => a.seat - b.seat);

    let sumDelta = 0;
    for (const s of seats) {
      const name = pNameMap.get(s.member_id) || `席${s.seat}`;
      sumDelta += (s.score_delta || 0);
      const flags = [];
      if (s.is_winner === 1) flags.push('和了');
      if (s.is_loser === 1) flags.push('放銃');
      if (s.is_riichi === 1) flags.push('立直');
      if (s.is_tenpai === 1) flags.push('聴牌');
      if (s.is_furo === 1) flags.push('副露');

      console.log(`  [席${s.seat}: ${name}] 局収支: ${s.score_delta >= 0 ? '+' : ''}${s.score_delta} (素点:${s.base_point}, 本場:${s.honba_point}, 供託:${s.kyotaku_point}, 罰符:${s.penalty_point}) 翻:${s.han} 符:${s.fu} [${flags.join(', ')}]`);
    }
    console.log(`  => この局の4席 score_delta 合計: ${sumDelta} (ゼロサム検算: ${sumDelta === 0 ? '正常 0' : '★不整合 ' + sumDelta + '★'})`);
  }
}

run().catch((e) => console.error(e));
