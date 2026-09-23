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

async function fetchAllRows(tableName) {
  const pageSize = 1000;
  let offset = 0;
  let allRows = [];
  while (true) {
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const data = await res.json();
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

import { computeAllRoundsDetails } from '../src/lib/mahjong/rules.ts';

async function run() {
  console.log('=== Webアプリ14対局の round_seats 一括修復処理開始 ===');

  const [games, parts, rounds, seats] = await Promise.all([
    fetchAllRows('games'),
    fetchAllRows('game_participants'),
    fetchAllRows('rounds'),
    fetchAllRows('round_seats'),
  ]);

  const newGames = games.filter((g) => new Date(g.created_at) > new Date('2026-09-10'));
  console.log(`対象Webアプリ対局数: ${newGames.length} 対局`);

  const roundsByGame = new Map();
  rounds.forEach((r) => {
    if (!roundsByGame.has(r.game_id)) roundsByGame.set(r.game_id, []);
    roundsByGame.get(r.game_id).push(r);
  });

  const partsByGame = new Map();
  parts.forEach((p) => {
    if (!partsByGame.has(p.game_id)) partsByGame.set(p.game_id, []);
    partsByGame.get(p.game_id).push(p);
  });

  const seatsByRound = new Map();
  seats.forEach((s) => {
    if (!seatsByRound.has(s.round_id)) seatsByRound.set(s.round_id, []);
    seatsByRound.get(s.round_id).push(s);
  });

  const patches = [];

  for (const g of newGames) {
    const gRounds = (roundsByGame.get(g.game_id) || []).sort((a, b) => a.round_index - b.round_index);
    const gParts = (partsByGame.get(g.game_id) || []).sort((a, b) => a.seat - b.seat);
    const playerNames = gParts.map((p) => p.player_name_snapshot);

    const history = gRounds.map((r) => {
      const rSeats = seatsByRound.get(r.round_id) || [];
      const winnerSeats = rSeats.filter((s) => s.is_winner === 1);
      const winnerSeat = winnerSeats[0] || null;
      const loserSeat = rSeats.find((s) => s.is_loser === 1);
      const riichiSeats = rSeats.filter((s) => s.is_riichi === 1);
      const tenpaiSeats = rSeats.filter((s) => s.is_tenpai === 1);

      const winnerPart = winnerSeat ? gParts.find((p) => p.member_id === winnerSeat.member_id) : null;
      const loserPart = loserSeat ? gParts.find((p) => p.member_id === loserSeat.member_id) : null;

      const multiWins = r.result_type === 'multi_ron'
        ? winnerSeats.map((ws) => {
            const p = gParts.find((pt) => pt.member_id === ws.member_id);
            return {
              winner: p?.player_name_snapshot || '',
              points_data: { total: ws.base_point, han: ws.han || 1, fu: ws.fu || 30 },
            };
          })
        : undefined;

      return {
        round_id: r.round_id,
        round_index: r.round_index,
        kyoku_name: r.kyoku_name,
        honba: r.honba,
        win_type: r.result_type,
        winner: winnerPart?.player_name_snapshot || null,
        loser: loserPart?.player_name_snapshot || null,
        score: winnerSeat?.base_point || 0,
        riichi: riichiSeats.map((s) => gParts.find((p) => p.member_id === s.member_id)?.player_name_snapshot).filter(Boolean),
        tenpai: tenpaiSeats.map((s) => gParts.find((p) => p.member_id === s.member_id)?.player_name_snapshot).filter(Boolean),
        multi_wins: multiWins,
      };
    });

    const initScore = g.rule_config_snapshot?.basic?.init_score ?? 25000;
    const ruleConfig = g.rule_config_snapshot || {};
    const computed = computeAllRoundsDetails(playerNames, initScore, ruleConfig, history);

    for (let i = 0; i < computed.length; i++) {
      const c = computed[i];
      const r = gRounds[i];
      const currentRoundSeats = seatsByRound.get(r.round_id) || [];

      for (const cs of c.seatDetails) {
        const cur = currentRoundSeats.find((s) => s.seat === cs.seat);
        if (!cur) continue;

        if (
          cur.base_point !== cs.basePoint ||
          cur.honba_point !== cs.honbaPoint ||
          cur.kyotaku_point !== cs.kyotakuPoint ||
          cur.penalty_point !== cs.penaltyPoint ||
          cur.score_delta !== cs.scoreDelta
        ) {
          patches.push({
            round_id: cur.round_id,
            seat: cur.seat,
            score_delta: cs.scoreDelta,
            base_point: cs.basePoint,
            honba_point: cs.honbaPoint,
            kyotaku_point: cs.kyotakuPoint,
            penalty_point: cs.penaltyPoint,
          });
        }
      }
    }
  }

  console.log(`修復対象レコード数: ${patches.length} 件`);

  let successCount = 0;
  let errorCount = 0;

  for (const patch of patches) {
    const url = `${supabaseUrl}/rest/v1/round_seats?round_id=eq.${patch.round_id}&seat=eq.${patch.seat}`;
    const body = {
      score_delta: patch.score_delta,
      base_point: patch.base_point,
      honba_point: patch.honba_point,
      kyotaku_point: patch.kyotaku_point,
      penalty_point: patch.penalty_point,
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      successCount++;
    } else {
      errorCount++;
      const txt = await res.text();
      console.error(`エラー [round_id=${patch.round_id}, seat=${patch.seat}]: ${txt}`);
    }
  }

  console.log(`修復完了: 成功 ${successCount} 件, 失敗 ${errorCount} 件`);
}

run().catch((e) => console.error(e));
