/**
 * 成績集計・分析ロジックモジュール (statsCalc.ts)
 * 試合成績、局詳細成績、推移グラフ、レコード、相性マトリクス計算
 * （ReactやDOM非依存の純粋関数群）
 */

export interface GameParticipantItem {
  seat: number;
  member_id: string;
  name: string;
  final_score: number;
  rank: number;
  point: number;
}

export interface GameData {
  game_id: string;
  played_at: string;
  group_id: string;
  rule_id: string;
  rule_name: string;
  rule_config: any;
  participants: GameParticipantItem[];
}

export interface RoundSeatItem {
  seat: number;
  member_id: string;
  score_delta: number;
  base_point: number;
  honba_point: number;
  kyotaku_point: number;
  penalty_point: number;
  is_winner: number;
  is_loser: number;
  is_riichi: number;
  is_furo: number;
  is_tenpai: number;
}

export interface RoundData {
  round_id: string;
  game_id: string;
  round_index: number;
  kyoku_name: string;
  honba: number;
  result_type: string;
  seats: RoundSeatItem[];
}

export interface GameStatsRow {
  name: string;
  games: number;
  totalPt: number;
  okaNashiPt: number;
  avgRank: number;
  rentaiRate: number;
  rasuAvoidRate: number;
  rank1Rate: number;
  rank2Rate: number;
  rank3Rate: number;
  rank4Rate: number;
  ranks: [number, number, number, number];
}

export interface RoundStatsRow {
  name: string;
  kyokuCount: number;
  agariRate: number;
  tsumoRate: number;
  houjuRate: number;
  agariHoujuDiff: number;
  tenpaiRate: number;
  notenBappu: number;
  kyotakuPoint: number;
  avgAgari: number;
  riichiAvgAgari: number;
  furoAvgAgari: number;
  damaAvgAgari: number;
  efficiency: number;
  riichiHoujuRate: number;
  furoHoujuRate: number;
  damaHoujuRate: number;
  avgHouju: number;
  riichiRate: number;
  riichiAgariRate: number;
  riichiHoujuRate2: number;
  furoRate: number;
  furoAgariRate: number;
  furoHoujuRate2: number;
  damaAgariRate: number;
}

export interface RecordsData {
  top5: { name: string; score: number; date: string }[];
  bottom5: { name: string; score: number; date: string }[];
  streaks: { name: string; maxStreak: number }[];
}

/**
 * 試合成績の集計
 */
export function calculateGameStats(
  effectiveGames: GameData[],
  sortBy: 'totalPt' | 'okaNashiPt' | 'avgRank' | 'games' = 'totalPt'
): GameStatsRow[] {
  const map = new Map<string, {
    name: string;
    games: number;
    totalPt: number;
    okaNashiPt: number;
    rankSum: number;
    ranks: [number, number, number, number];
  }>();

  for (const g of effectiveGames) {
    const oka = 20.0;
    const umaMap: { [rank: number]: number } = { 1: 50, 2: 10, 3: -10, 4: -30 };

    for (const p of g.participants) {
      if (!map.has(p.name)) {
        map.set(p.name, {
          name: p.name,
          games: 0,
          totalPt: 0,
          okaNashiPt: 0,
          rankSum: 0,
          ranks: [0, 0, 0, 0],
        });
      }
      const item = map.get(p.name)!;
      item.games += 1;
      item.totalPt += p.point;

      // オカなし計算
      const basePt = (p.final_score - 25000) / 1000;
      const uma = umaMap[p.rank] || 0;
      const okaDeduct = p.rank === 1 ? oka : 0;
      item.okaNashiPt += (basePt + uma - okaDeduct);

      if (p.rank >= 1 && p.rank <= 4) {
        item.ranks[p.rank - 1] += 1;
        item.rankSum += p.rank;
      }
    }
  }

  return Array.from(map.values())
    .map((item) => {
      const g = item.games;
      return {
        name: item.name,
        games: g,
        totalPt: Math.round(item.totalPt * 10) / 10,
        okaNashiPt: Math.round(item.okaNashiPt * 10) / 10,
        avgRank: g > 0 ? Math.round((item.rankSum / g) * 100) / 100 : 0,
        rentaiRate: g > 0 ? Math.round(((item.ranks[0] + item.ranks[1]) / g) * 1000) / 10 : 0,
        rasuAvoidRate: g > 0 ? Math.round(((item.ranks[0] + item.ranks[1] + item.ranks[2]) / g) * 1000) / 10 : 0,
        rank1Rate: g > 0 ? Math.round((item.ranks[0] / g) * 1000) / 10 : 0,
        rank2Rate: g > 0 ? Math.round((item.ranks[1] / g) * 1000) / 10 : 0,
        rank3Rate: g > 0 ? Math.round((item.ranks[2] / g) * 1000) / 10 : 0,
        rank4Rate: g > 0 ? Math.round((item.ranks[3] / g) * 1000) / 10 : 0,
        ranks: item.ranks,
      };
    })
    .sort((a, b) => {
      if (sortBy === 'totalPt') return b.totalPt - a.totalPt;
      if (sortBy === 'okaNashiPt') return b.okaNashiPt - a.okaNashiPt;
      if (sortBy === 'avgRank') return a.avgRank - b.avgRank;
      if (sortBy === 'games') return b.games - a.games;
      return 0;
    });
}

/**
 * 局詳細成績（5タブ用）の集計
 */
export function calculateRoundStats(
  effectiveGames: GameData[],
  rounds: RoundData[]
): { roundStats: RoundStatsRow[]; detailedGameCount: number } {
  const gameIdsSet = new Set(effectiveGames.map((g) => g.game_id));
  const targetRounds = rounds.filter((r) => gameIdsSet.has(r.game_id));
  const detailedGameIds = new Set(targetRounds.map((r) => r.game_id));

  // プレイヤー別集計用マップ
  const pMap = new Map<string, {
    kyoku: number;
    agari: number;
    tsumo: number;
    houju: number;
    riichi: number;
    furo: number;
    ryukyoku: number;
    tenpai: number;
    riichiAgari: number;
    riichiHouju: number;
    furoAgari: number;
    furoHouju: number;
    damaAgari: number;
    agariPtSum: number;
    houjuPtSum: number;
    riichiAgariPtSum: number;
    furoAgariPtSum: number;
    damaAgariPtSum: number;
    beRiichiHouju: number;
    beFuroHouju: number;
    beDamaHouju: number;
    kyotakuPoint: number;
    notenBappu: number;
  }>();

  const gPlayerNames = new Map<string, Map<string, string>>();
  for (const g of effectiveGames) {
    const pmap = new Map<string, string>();
    g.participants.forEach((p) => {
      pmap.set(p.member_id, p.name);
      pmap.set(String(p.seat), p.name);
    });
    gPlayerNames.set(g.game_id, pmap);
  }

  const initPlayer = (name: string) => {
    if (!pMap.has(name)) {
      pMap.set(name, {
        kyoku: 0,
        agari: 0,
        tsumo: 0,
        houju: 0,
        riichi: 0,
        furo: 0,
        ryukyoku: 0,
        tenpai: 0,
        riichiAgari: 0,
        riichiHouju: 0,
        furoAgari: 0,
        furoHouju: 0,
        damaAgari: 0,
        agariPtSum: 0,
        houjuPtSum: 0,
        riichiAgariPtSum: 0,
        furoAgariPtSum: 0,
        damaAgariPtSum: 0,
        beRiichiHouju: 0,
        beFuroHouju: 0,
        beDamaHouju: 0,
        kyotakuPoint: 0,
        notenBappu: 0,
      });
    }
    return pMap.get(name)!;
  };

  for (const r of targetRounds) {
    const pmap = gPlayerNames.get(r.game_id);
    if (!pmap) continue;

    const isRyukyoku = r.result_type === 'ryukyoku';
    const isTsumo = r.result_type === 'tsumo';

    // 局コンテキスト（局内に立直者・副露者がいたか判定）
    const hasRiichiInRound = r.seats.some((s) => s.is_riichi === 1);
    const hasFuroInRound = r.seats.some((s) => s.is_furo === 1);

    const seatsWithNames = r.seats
      .map((s) => ({
        ...s,
        name: pmap.get(s.member_id) || pmap.get(String(s.seat)) || '',
      }))
      .filter((s) => s.name !== '');

    for (const s of seatsWithNames) {
      const item = initPlayer(s.name);
      item.kyoku += 1;

      // 和了集計 (base_point を使用)
      if (s.is_winner === 1) {
        item.agari += 1;
        if (isTsumo) item.tsumo += 1;
        const bPt = s.base_point || 0;
        item.agariPtSum += bPt;

        if (s.is_riichi === 1) {
          item.riichiAgari += 1;
          item.riichiAgariPtSum += bPt;
        } else if (s.is_furo === 1) {
          item.furoAgari += 1;
          item.furoAgariPtSum += bPt;
        } else {
          item.damaAgari += 1;
          item.damaAgariPtSum += bPt;
        }
      }

      // 放銃集計 (ABS(base_point) を使用)
      if (s.is_loser === 1) {
        item.houju += 1;
        item.houjuPtSum += Math.abs(s.base_point || 0);

        if (s.is_riichi === 1) item.riichiHouju += 1;
        if (s.is_furo === 1) item.furoHouju += 1;

        if (hasRiichiInRound) {
          item.beRiichiHouju += 1;
        } else if (hasFuroInRound) {
          item.beFuroHouju += 1;
        } else {
          item.beDamaHouju += 1;
        }
      }

      // 立直・副露・流局テンパイ
      if (s.is_riichi === 1) item.riichi += 1;
      if (s.is_furo === 1) item.furo += 1;
      if (isRyukyoku) {
        item.ryukyoku += 1;
        if (s.is_tenpai === 1) item.tenpai += 1;
      }

      // 供託収支・ノーテン罰符収支（DB値をそのまま累計）
      item.kyotakuPoint += (s.kyotaku_point || 0);
      item.notenBappu += (s.penalty_point || 0);
    }
  }

  const rows: RoundStatsRow[] = Array.from(pMap.entries()).map(([name, d]) => {
    const k = d.kyoku;
    const w = d.agari;
    const h = d.houju;
    const rCount = d.riichi;
    const fCount = d.furo;

    const avgAgari = w > 0 ? Math.round(d.agariPtSum / w) : 0;
    const avgHouju = h > 0 ? Math.round(d.houjuPtSum / h) : 0;
    const efficiency = (avgAgari > 0 && avgHouju > 0) ? Math.round((avgAgari / avgHouju) * 100) / 100 : 0;

    return {
      name,
      kyokuCount: k,
      agariRate: k > 0 ? Math.round((w / k) * 1000) / 10 : 0,
      tsumoRate: w > 0 ? Math.round((d.tsumo / w) * 1000) / 10 : 0,
      houjuRate: k > 0 ? Math.round((h / k) * 1000) / 10 : 0,
      agariHoujuDiff: k > 0 ? Math.round(((w - h) / k) * 1000) / 10 : 0,
      tenpaiRate: d.ryukyoku > 0 ? Math.round((d.tenpai / d.ryukyoku) * 1000) / 10 : 0,
      notenBappu: d.notenBappu,
      kyotakuPoint: d.kyotakuPoint,
      avgAgari,
      riichiAvgAgari: d.riichiAgari > 0 ? Math.round(d.riichiAgariPtSum / d.riichiAgari) : 0,
      furoAvgAgari: d.furoAgari > 0 ? Math.round(d.furoAgariPtSum / d.furoAgari) : 0,
      damaAvgAgari: d.damaAgari > 0 ? Math.round(d.damaAgariPtSum / d.damaAgari) : 0,
      efficiency,
      riichiHoujuRate: h > 0 ? Math.round((d.beRiichiHouju / h) * 1000) / 10 : 0,
      furoHoujuRate: h > 0 ? Math.round((d.beFuroHouju / h) * 1000) / 10 : 0,
      damaHoujuRate: h > 0 ? Math.round((d.beDamaHouju / h) * 1000) / 10 : 0,
      avgHouju,
      riichiRate: k > 0 ? Math.round((rCount / k) * 1000) / 10 : 0,
      riichiAgariRate: rCount > 0 ? Math.round((d.riichiAgari / rCount) * 1000) / 10 : 0,
      riichiHoujuRate2: rCount > 0 ? Math.round((d.riichiHouju / rCount) * 1000) / 10 : 0,
      furoRate: k > 0 ? Math.round((fCount / k) * 1000) / 10 : 0,
      furoAgariRate: fCount > 0 ? Math.round((d.furoAgari / fCount) * 1000) / 10 : 0,
      furoHoujuRate2: fCount > 0 ? Math.round((d.furoHouju / fCount) * 1000) / 10 : 0,
      damaAgariRate: w > 0 ? Math.round((d.damaAgari / w) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.agariRate - a.agariRate);

  return {
    roundStats: rows,
    detailedGameCount: detailedGameIds.size,
  };
}

/**
 * 総合ポイント推移グラフデータ計算
 */
export function calculateChartData(
  effectiveGames: GameData[],
  chartMembers: string[]
): { label: string; values: { [name: string]: number } }[] {
  const sorted = [...effectiveGames].sort((a, b) => (a.played_at > b.played_at ? 1 : -1));
  const cumMap = new Map<string, number>();
  chartMembers.forEach((m) => cumMap.set(m, 0));

  const pointsSeries: { label: string; values: { [name: string]: number } }[] = [
    { label: '開始', values: Object.fromEntries(chartMembers.map((m) => [m, 0])) },
  ];

  sorted.forEach((g, idx) => {
    const vals: { [name: string]: number } = {};
    chartMembers.forEach((m) => {
      const p = g.participants.find((part) => part.name === m);
      const pt = p ? p.point : 0;
      const nextCum = (cumMap.get(m) || 0) + pt;
      cumMap.set(m, nextCum);
      vals[m] = Math.round(nextCum * 10) / 10;
    });
    pointsSeries.push({
      label: `G${idx + 1}`,
      values: vals,
    });
  });

  return pointsSeries;
}

/**
 * レコード（最高Top5、最低Top5、連勝記録）計算
 */
export function calculateRecords(effectiveGames: GameData[]): RecordsData {
  const allScores: { name: string; score: number; date: string }[] = [];
  effectiveGames.forEach((g) => {
    const d = g.played_at ? g.played_at.slice(0, 10) : '不明';
    g.participants.forEach((p) => {
      allScores.push({ name: p.name, score: p.final_score, date: d });
    });
  });

  const top5 = [...allScores].sort((a, b) => b.score - a.score).slice(0, 5);
  const bottom5 = [...allScores].sort((a, b) => a.score - b.score).slice(0, 5);

  const streakList: { name: string; maxStreak: number }[] = [];
  const playerGamesMap = new Map<string, { played_at: string; rank: number }[]>();
  effectiveGames.forEach((g) => {
    g.participants.forEach((p) => {
      if (!playerGamesMap.has(p.name)) playerGamesMap.set(p.name, []);
      playerGamesMap.get(p.name)!.push({ played_at: g.played_at, rank: p.rank });
    });
  });

  playerGamesMap.forEach((gList, name) => {
    const sorted = gList.sort((a, b) => (a.played_at > b.played_at ? 1 : -1));
    let maxS = 0;
    let cur = 0;
    sorted.forEach((r) => {
      if (r.rank === 1) {
        cur += 1;
        if (cur > maxS) maxS = cur;
      } else {
        cur = 0;
      }
    });
    if (maxS >= 2) {
      streakList.push({ name, maxStreak: maxS });
    }
  });

  streakList.sort((a, b) => b.maxStreak - a.maxStreak);

  return { top5, bottom5, streaks: streakList };
}

/**
 * 相性マトリクス（直接対決pt差）計算
 */
export function calculateCompatibilityMatrix(
  effectiveGames: GameData[],
  matrixMembers: string[]
): Map<string, Map<string, number>> {
  const diffMap = new Map<string, Map<string, number>>();
  matrixMembers.forEach((m1) => {
    const row = new Map<string, number>();
    matrixMembers.forEach((m2) => row.set(m2, 0));
    diffMap.set(m1, row);
  });

  effectiveGames.forEach((g) => {
    for (const p1 of g.participants) {
      if (!matrixMembers.includes(p1.name)) continue;
      for (const p2 of g.participants) {
        if (p1.name === p2.name) continue;
        if (!matrixMembers.includes(p2.name)) continue;

        const diff = p1.point - p2.point;
        const current = diffMap.get(p1.name)!.get(p2.name) || 0;
        diffMap.get(p1.name)!.set(p2.name, current + diff);
      }
    }
  });

  return diffMap;
}
