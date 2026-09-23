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
  // 1. 最新の1ゲームを取得
  const gRes = await fetch(`${supabaseUrl}/rest/v1/games?select=*&order=created_at.desc&limit=1`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const games = await gRes.json();
  if (!games || games.length === 0) {
    console.log('対局が見つかりませんでした。');
    return;
  }

  const latestGame = games[0];
  const gameId = latestGame.game_id;
  console.log(`=== 最新対局情報 ===`);
  console.log(`対局ID: ${gameId}`);
  console.log(`作成日時: ${latestGame.created_at}`);
  console.log(`ステータス: ${latestGame.status}`);
  console.log(`ルール名: ${latestGame.rule_name_snapshot}`);

  // 2. 参加者、局、座席データを取得
  const [partsRes, roundsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/game_participants?game_id=eq.${gameId}&order=seat.asc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${gameId}&order=round_index.asc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    }),
  ]);

  const parts = await partsRes.json();
  const rounds = await roundsRes.json();
  const roundIds = rounds.map((r) => r.round_id);

  const seatsRes = await fetch(`${supabaseUrl}/rest/v1/round_seats?round_id=in.(${roundIds.join(',')})&order=seat.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const seats = await seatsRes.json();

  console.log(`\n=== 参加者（精算結果） ===`);
  for (const p of parts) {
    console.log(`席${p.seat} ${p.player_name_snapshot}: 素点=${p.final_score}, 順位=${p.rank}位, pt=${p.point}`);
  }

  console.log(`\n=== 局詳細・内訳検証 (全${rounds.length}局・全${seats.length}席) ===`);
  let allIdentitiesHold = true;
  let ryukyokuBaseZero = true;
  let totalGameKyotaku = 0;

  for (const r of rounds) {
    const rSeats = seats.filter((s) => s.round_id === r.round_id).sort((a, b) => a.seat - b.seat);
    console.log(`\n[R${r.round_index}] ${r.kyoku_name} ${r.honba}本場 (供託残:${r.riichi_sticks}本) - 結果: ${r.result_type}`);

    for (const s of rSeats) {
      const p = parts.find((pt) => pt.member_id === s.member_id || pt.seat === s.seat);
      const name = p?.player_name_snapshot || `席${s.seat}`;
      const sum = (s.base_point || 0) + (s.honba_point || 0) + (s.kyotaku_point || 0) + (s.penalty_point || 0);
      const identityOk = sum === s.score_delta;
      if (!identityOk) allIdentitiesHold = false;

      if (r.result_type === 'ryukyoku' && s.base_point !== 0) {
        ryukyokuBaseZero = false;
      }

      totalGameKyotaku += (s.kyotaku_point || 0);

      const flags = [
        s.is_winner === 1 ? '和了' : '',
        s.is_loser === 1 ? '放銃' : '',
        s.is_riichi === 1 ? '立直' : '',
        s.is_tenpai === 1 ? '聴牌' : '',
      ].filter(Boolean).join('/');

      const identityMark = identityOk ? 'OK' : 'NG(不整合)';
      console.log(`  ${name.padEnd(8)}: delta=${String(s.score_delta).padStart(6)} = base(${s.base_point}) + honba(${s.honba_point}) + kyo(${s.kyotaku_point}) + pen(${s.penalty_point}) [恒等式: ${identityMark}] (flags: ${flags || 'なし'})`);
    }
  }

  console.log(`\n=== 総合検証判定 ===`);
  console.log(`1. 全局・全席の内訳恒等式 (base + honba + kyotaku + penalty === delta): ${allIdentitiesHold ? '完全一致 (PASS)' : '不整合あり (FAIL)'}`);
  console.log(`2. 流局時の手役素点 (base_point === 0): ${ryukyokuBaseZero ? '完全ゼロ (PASS)' : 'ゼロでないレコードあり (FAIL)'}`);

  // 3. 各プレイヤーの score_delta 累計と final_score の比較
  console.log(`\n3. 持ち点推移と精算スコア (final_score) の検算:`);
  const initScore = latestGame.rule_config_snapshot?.basic?.init_score ?? 25000;
  let finalScoreCheckPassed = true;

  // 最終局時点での余り供託棒を計算
  // 最後のラウンド後の供託棒
  let lastRemSticks = 0;
  for (const r of rounds) {
    const rSeats = seats.filter((s) => s.round_id === r.round_id);
    const riichiCount = rSeats.filter((s) => s.is_riichi === 1).length;
    lastRemSticks += riichiCount;
    const hasWin = rSeats.some((s) => s.is_winner === 1) || ['ron', 'tsumo', 'multi_ron'].includes(r.result_type);
    if (hasWin) lastRemSticks = 0;
  }
  const riichiPt = latestGame.rule_config_snapshot?.detail?.riichi_pt ?? 1000;
  const stickBonus = lastRemSticks * riichiPt;
  console.log(`  終局時余り供託棒: ${lastRemSticks}本 (+${stickBonus}点)`);

  for (const p of parts) {
    let deltaSum = 0;
    for (const r of rounds) {
      const rSeats = seats.filter((s) => s.round_id === r.round_id);
      const s = rSeats.find((st) => st.member_id === p.member_id || st.seat === p.seat);
      if (s) deltaSum += s.score_delta;
    }
    const expectedFinal = initScore + deltaSum + (p.rank === 1 ? stickBonus : 0);
    const match = expectedFinal === p.final_score;
    if (!match) finalScoreCheckPassed = false;
    console.log(`  ${p.player_name_snapshot.padEnd(8)}: 初期(${initScore}) + delta累計(${deltaSum}) + トップ供託(${p.rank === 1 ? stickBonus : 0}) = 算出(${expectedFinal}) vs DB記録(${p.final_score}) [${match ? '完全一致' : '不一致'}]`);
  }
  console.log(`  判定: ${finalScoreCheckPassed ? '全プレイヤー完全一致 (PASS)' : '不一致あり (FAIL)'}`);

  // 4. 供託ゼロサム検算
  console.log(`\n4. 供託収支のゼロサム検算:`);
  console.log(`  局中供託合計: ${totalGameKyotaku}点, 終局トップ取り供託: +${stickBonus}点`);
  const kyotakuSum = totalGameKyotaku + stickBonus;
  console.log(`  合算: ${kyotakuSum}点 [${kyotakuSum === 0 ? '完全ゼロサム (PASS)' : 'ゼロサム不整合 (FAIL)'}]`);
}

run().catch((e) => console.error(e));
