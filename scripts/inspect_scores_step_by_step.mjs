import fs from 'fs';
import path from 'path';
import { recalculateState } from '../src/lib/mahjong/rules.ts';

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
  const gRes = await fetch(`${supabaseUrl}/rest/v1/games?select=*&order=played_at.desc&limit=1`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const game = (await gRes.json())[0];

  const pRes = await fetch(`${supabaseUrl}/rest/v1/game_participants?game_id=eq.${game.game_id}&order=seat.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const participants = await pRes.json();
  const playerNames = participants.map((p) => p.player_name_snapshot);

  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${game.game_id}&select=*,round_seats(*)&order=round_index.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();

  // RoundRecord 配列へ復元
  const history = rounds.map((r) => {
    const seats = r.round_seats || [];
    const winnerSeat = seats.find((s) => s.is_winner === 1);
    const loserSeat = seats.find((s) => s.is_loser === 1);
    const riichiSeats = seats.filter((s) => s.is_riichi === 1);
    const tenpaiSeats = seats.filter((s) => s.is_tenpai === 1);

    const winnerPart = winnerSeat ? participants.find((p) => p.member_id === winnerSeat.member_id) : null;
    const loserPart = loserSeat ? participants.find((p) => p.member_id === loserSeat.member_id) : null;

    return {
      round_id: r.round_id,
      round_index: r.round_index,
      kyoku_name: r.kyoku_name,
      honba: r.honba,
      win_type: r.result_type,
      winner: winnerPart ? winnerPart.player_name_snapshot : null,
      loser: loserPart ? loserPart.player_name_snapshot : null,
      score: winnerSeat ? winnerSeat.base_point : 0,
      riichi: riichiSeats.map((s) => participants.find((p) => p.member_id === s.member_id)?.player_name_snapshot).filter(Boolean),
      tenpai: tenpaiSeats.map((s) => participants.find((p) => p.member_id === s.member_id)?.player_name_snapshot).filter(Boolean),
      han: winnerSeat ? winnerSeat.han : null,
      fu: winnerSeat ? winnerSeat.fu : null,
    };
  });

  console.log('=== 各局終了時の画面表示スコア（recalculateStateによる持ち点） ===\n');

  for (let i = 0; i < history.length; i++) {
    const subHistory = history.slice(0, i + 1);
    const state = recalculateState(playerNames, 25000, game.rule_config_snapshot, subHistory);
    const r = history[i];

    console.log(`第${i + 1}局【${r.kyoku_name} ${r.honba}本場】結果: ${r.win_type} (和了: ${r.winner || 'なし'}, 放銃: ${r.loser || 'なし'}, 供託獲得: ${r.score}点, 立直者: [${r.riichi.join(', ')}])`);
    console.log(`  次局開始時の卓上供託棒: ${state.riichiStick}本, 次局本場: ${state.honba}本場`);
    console.log(`  画面スコア: ` + playerNames.map((p) => `${p}: ${state.scores[p]}`).join(' | '));

    // 累積 score_delta の合計
    const dbCumulative = {};
    playerNames.forEach((p) => dbCumulative[p] = 25000);
    for (let j = 0; j <= i; j++) {
      const rd = rounds[j];
      for (const s of rd.round_seats) {
        const p = participants.find((pt) => pt.member_id === s.member_id)?.player_name_snapshot;
        if (p) dbCumulative[p] += s.score_delta;
      }
    }
    console.log(`  DB累積スコア: ` + playerNames.map((p) => `${p}: ${dbCumulative[p]}`).join(' | '));
    console.log('');
  }
}

run().catch(console.error);
