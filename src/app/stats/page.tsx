/**
 * 成績集計画面 (/stats)
 * mahjong_personal の stats.py / calc.py 完全準拠
 * 試合成績、詳細5タブ（基本・打点・守備・立直・副露）、推移グラフ、レコード、相性マトリクス、対局履歴
 * アコーディオン式 試合ID詳細フィルター（クイック選択ボタン付き）
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GameRow, GameParticipantRow, MemberRow, RuleTemplateRow } from '@/types/database';

interface GameData {
  game_id: string;
  played_at: string;
  group_id: string;
  rule_id: string;
  rule_name: string;
  rule_config: any;
  participants: {
    seat: number;
    member_id: string;
    name: string;
    final_score: number;
    rank: number;
    point: number;
  }[];
}

interface RoundData {
  round_id: string;
  game_id: string;
  round_index: number;
  kyoku_name: string;
  honba: number;
  result_type: string;
  seats: {
    seat: number;
    member_id: string;
    score_delta: number;
    base_point: number;
    honba_point: number;
    is_winner: number;
    is_loser: number;
    is_riichi: number;
    is_furo: number;
    is_tenpai: number;
  }[];
}

interface GameStatsRow {
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

interface RoundStatsRow {
  name: string;
  kyokuCount: number;
  agariRate: number;
  tsumoRate: number;
  houjuRate: number;
  agariHoujuDiff: number;
  tenpaiRate: number;
  notenBappu: number;
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

export default function StatsPage() {
  const [games, setGames] = useState<GameData[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルター状態
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [includeGuests, setIncludeGuests] = useState<boolean>(true);

  // 詳細試合IDアコーディオンフィルター
  const [showIdAccordion, setShowIdAccordion] = useState<boolean>(false);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);

  // 試合成績ソート
  const [sortBy, setSortBy] = useState<'totalPt' | 'okaNashiPt' | 'avgRank' | 'games'>('totalPt');

  // 詳細成績タブ (basic, datan, syubi, riichi, furo)
  const [activeDetailTab, setActiveDetailTab] = useState<'basic' | 'datan' | 'syubi' | 'riichi' | 'furo'>('basic');

  // グラフ用選択プレイヤー
  const [chartMembers, setChartMembers] = useState<string[]>([]);

  // 相性マトリクス用選択プレイヤー
  const [matrixMembers, setMatrixMembers] = useState<string[]>([]);

  // 対局詳細モーダル
  const [modalGameId, setModalGameId] = useState<string | null>(null);

  // ── データ取得 ──
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. games 取得
        const { data: gData } = await supabase
          .from('games')
          .select('*')
          .order('played_at', { ascending: false });

        // 2. game_participants 取得
        const { data: pData } = await supabase
          .from('game_participants')
          .select('*');

        // 3. rounds 取得
        const { data: rData } = await supabase
          .from('rounds')
          .select('*')
          .order('round_index', { ascending: true });

        // 4. round_seats 取得
        const { data: sData } = await supabase
          .from('round_seats')
          .select('*');

        // 5. groups / rules / members 取得
        const { data: grpData } = await supabase.from('groups').select('*').eq('is_archived', 0);
        const { data: ruleData } = await supabase.from('rule_templates').select('*').eq('is_archived', 0);
        const { data: memData } = await supabase.from('members').select('*').eq('is_archived', 0);

        if (grpData) setGroups(grpData);
        if (ruleData) setRules(ruleData as any);
        if (memData) setMembers(memData);

        const gList: GameRow[] = (gData as any[]) || [];
        const pList: GameParticipantRow[] = (pData as any[]) || [];
        const roundList: any[] = (rData as any[]) || [];
        const seatList: any[] = (sData as any[]) || [];

        // games マッピング
        const mappedGames: GameData[] = gList.map((g) => {
          const parts = pList
            .filter((p) => p.game_id === g.game_id)
            .sort((a, b) => a.rank - b.rank)
            .map((p) => ({
              seat: p.seat,
              member_id: p.member_id,
              name: p.player_name_snapshot,
              final_score: p.final_score,
              rank: p.rank,
              point: Number(p.point),
            }));

          return {
            game_id: g.game_id,
            played_at: g.played_at || '',
            group_id: g.group_id || '',
            rule_id: (g as any).rule_id || '',
            rule_name: g.rule_name_snapshot || '標準ルール',
            rule_config: g.rule_config_snapshot || {},
            participants: parts,
          };
        });

        // rounds マッピング
        const mappedRounds: RoundData[] = roundList.map((r) => {
          const seats = seatList
            .filter((s) => s.round_id === r.round_id)
            .map((s) => ({
              seat: s.seat,
              member_id: s.member_id,
              score_delta: s.score_delta,
              base_point: s.base_point,
              honba_point: s.honba_point,
              is_winner: s.is_winner,
              is_loser: s.is_loser,
              is_riichi: s.is_riichi,
              is_furo: s.is_furo,
              is_tenpai: s.is_tenpai,
            }));

          return {
            round_id: r.round_id,
            game_id: r.game_id,
            round_index: r.round_index,
            kyoku_name: r.kyoku_name,
            honba: r.honba,
            result_type: r.result_type,
            seats,
          };
        });

        setGames(mappedGames);
        setRounds(mappedRounds);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 年の選択肢
  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      if (g.played_at) {
        const y = g.played_at.slice(0, 4);
        if (y) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [games]);

  // 第1段階: グループ・ルール・年による基本母集団
  const baseFilteredGames = useMemo(() => {
    return games.filter((g) => {
      if (selectedGroupId !== 'all' && g.group_id !== selectedGroupId) return false;
      if (selectedRuleId !== 'all') {
        const rMatch = rules.find((r) => r.rule_id === selectedRuleId);
        if (rMatch && g.rule_name !== rMatch.name && g.rule_id !== selectedRuleId) return false;
      }
      if (selectedYear !== 'all' && !g.played_at.startsWith(selectedYear)) return false;
      return true;
    });
  }, [games, selectedGroupId, selectedRuleId, selectedYear, rules]);

  // 試合ID詳細フィルターで実際に集計対象となる試合群
  const effectiveGames = useMemo(() => {
    if (selectedGameIds.length === 0) {
      // 0件選択時は母集団全体
      return baseFilteredGames;
    }
    return baseFilteredGames.filter((g) => selectedGameIds.includes(g.game_id));
  }, [baseFilteredGames, selectedGameIds]);

  // クイック選択ハンドラー
  const handleQuickSelect = (count: number) => {
    if (count === -1) {
      // 全選択
      setSelectedGameIds(baseFilteredGames.map((g) => g.game_id));
    } else {
      setSelectedGameIds(baseFilteredGames.slice(0, count).map((g) => g.game_id));
    }
  };

  const handleClearSelection = () => {
    setSelectedGameIds([]);
  };

  const handleToggleGameId = (id: string) => {
    setSelectedGameIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  // ── 試合成績の集計 ──
  const gameStats = useMemo<GameStatsRow[]>(() => {
    const map = new Map<string, {
      name: string;
      games: number;
      totalPt: number;
      okaNashiPt: number;
      rankSum: number;
      ranks: [number, number, number, number];
    }>();

    for (const g of effectiveGames) {
      // オカ計算: 返し30000, 配給25000 -> 20pt
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
  }, [effectiveGames, sortBy]);

  // 初期グラフ・マトリクス対象プレイヤーの設定
  useEffect(() => {
    if (gameStats.length > 0 && chartMembers.length === 0) {
      setChartMembers(gameStats.slice(0, Math.min(5, gameStats.length)).map((s) => s.name));
    }
    if (gameStats.length > 0 && matrixMembers.length === 0) {
      setMatrixMembers(gameStats.slice(0, Math.min(5, gameStats.length)).map((s) => s.name));
    }
  }, [gameStats]);

  // ── 詳細成績（5タブ用）の集計 ──
  const { roundStats, detailedGameCount } = useMemo(() => {
    const gameIdsSet = new Set(effectiveGames.map((g) => g.game_id));
    const targetRounds = rounds.filter((r) => gameIdsSet.has(r.game_id));
    const detailedGameIds = new Set(targetRounds.map((r) => r.game_id));

    // プレイヤー名ごとの局カウンター
    const pMap = new Map<string, {
      kyoku: number;
      agari: number;
      tsumo: number;
      houju: number;
      furo: number;
      riichi: number;
      riichiAgari: number;
      riichiHouju: number;
      furoAgari: number;
      furoHouju: number;
      damaAgari: number;
      riichiAgariPt: number;
      furoAgariPt: number;
      damaAgariPt: number;
      beRiichiHouju: number;
      beFuroHouju: number;
      beDamaHouju: number;
      agariPt: number;
      houjuPt: number;
      ryukyoku: number;
      tenpai: number;
      notenBappu: number;
    }>();

    // 参加者マッピング用: game_id -> [member_id or seat -> name]
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
          furo: 0,
          riichi: 0,
          riichiAgari: 0,
          riichiHouju: 0,
          furoAgari: 0,
          furoHouju: 0,
          damaAgari: 0,
          riichiAgariPt: 0,
          furoAgariPt: 0,
          damaAgariPt: 0,
          beRiichiHouju: 0,
          beFuroHouju: 0,
          beDamaHouju: 0,
          agariPt: 0,
          houjuPt: 0,
          ryukyoku: 0,
          tenpai: 0,
          notenBappu: 0,
        });
      }
      return pMap.get(name)!;
    };

    for (const r of targetRounds) {
      const pmap = gPlayerNames.get(r.game_id);
      if (!pmap) continue;

      const isRyukyoku = r.result_type === 'ryukyoku';
      const winnerSeat = r.seats.find((s) => s.is_winner === 1);
      const loserSeat = r.seats.find((s) => s.is_loser === 1);

      // 各座席のプレイヤー名特定
      const seatsWithNames = r.seats.map((s) => ({
        ...s,
        name: pmap.get(s.member_id) || pmap.get(String(s.seat)) || '',
      })).filter((s) => s.name !== '');

      // 局数カウント & 立直・副露・テンパイ集計
      for (const s of seatsWithNames) {
        const item = initPlayer(s.name);
        item.kyoku += 1;
        if (s.is_riichi === 1) item.riichi += 1;
        if (s.is_furo === 1) item.furo += 1;
        if (isRyukyoku) {
          item.ryukyoku += 1;
          if (s.is_tenpai === 1) item.tenpai += 1;
        }
      }

      // 流局時のノーテン罰符
      if (isRyukyoku) {
        const tenpaiSeats = seatsWithNames.filter((s) => s.is_tenpai === 1);
        const notenSeats = seatsWithNames.filter((s) => s.is_tenpai !== 1);
        if (tenpaiSeats.length > 0 && tenpaiSeats.length < 4) {
          const getPt = Math.floor(3000 / tenpaiSeats.length);
          const payPt = Math.floor(3000 / notenSeats.length);
          tenpaiSeats.forEach((s) => { initPlayer(s.name).notenBappu += getPt; });
          notenSeats.forEach((s) => { initPlayer(s.name).notenBappu -= payPt; });
        }
      }

      // 和了者集計
      if (winnerSeat) {
        const wName = pmap.get(winnerSeat.member_id) || pmap.get(String(winnerSeat.seat));
        if (wName) {
          const wItem = initPlayer(wName);
          wItem.agari += 1;
          const score = winnerSeat.score_delta > 0 ? winnerSeat.score_delta : (winnerSeat.base_point + winnerSeat.honba_point);
          wItem.agariPt += score;

          const isTsumo = r.result_type === 'tsumo' || !loserSeat;
          if (isTsumo) wItem.tsumo += 1;

          if (winnerSeat.is_riichi === 1) {
            wItem.riichiAgari += 1;
            wItem.riichiAgariPt += score;
          } else if (winnerSeat.is_furo === 1) {
            wItem.furoAgari += 1;
            wItem.furoAgariPt += score;
          } else {
            wItem.damaAgari += 1;
            wItem.damaAgariPt += score;
          }
        }
      }

      // 放銃者集計
      if (loserSeat && winnerSeat) {
        const lName = pmap.get(loserSeat.member_id) || pmap.get(String(loserSeat.seat));
        if (lName) {
          const lItem = initPlayer(lName);
          lItem.houju += 1;
          const loseScore = Math.abs(loserSeat.score_delta) || (winnerSeat.base_point + winnerSeat.honba_point);
          lItem.houjuPt += loseScore;

          if (loserSeat.is_riichi === 1) lItem.riichiHouju += 1;
          if (loserSeat.is_furo === 1) lItem.furoHouju += 1;

          if (winnerSeat.is_riichi === 1) {
            lItem.beRiichiHouju += 1;
          } else if (winnerSeat.is_furo === 1) {
            lItem.beFuroHouju += 1;
          } else {
            lItem.beDamaHouju += 1;
          }
        }
      }
    }

    const rows: RoundStatsRow[] = Array.from(pMap.entries()).map(([name, d]) => {
      const k = d.kyoku;
      const w = d.agari;
      const h = d.houju;
      const rCount = d.riichi;
      const fCount = d.furo;

      const avgAgari = w > 0 ? Math.round(d.agariPt / w) : 0;
      const avgHouju = h > 0 ? Math.round(d.houjuPt / h) : 0;
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
        avgAgari,
        riichiAvgAgari: d.riichiAgari > 0 ? Math.round(d.riichiAgariPt / d.riichiAgari) : 0,
        furoAvgAgari: d.furoAgari > 0 ? Math.round(d.furoAgariPt / d.furoAgari) : 0,
        damaAvgAgari: d.damaAgari > 0 ? Math.round(d.damaAgariPt / d.damaAgari) : 0,
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
  }, [effectiveGames, rounds]);

  // ── 総合ポイント推移グラフデータ ──
  const chartData = useMemo(() => {
    // 試合日時昇順で並び替え
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
  }, [effectiveGames, chartMembers]);

  // ── レコード（最高Top5、最低Top5、連勝記録） ──
  const records = useMemo(() => {
    const allScores: { name: string; score: number; date: string }[] = [];
    effectiveGames.forEach((g) => {
      const d = g.played_at ? g.played_at.slice(0, 10) : '不明';
      g.participants.forEach((p) => {
        allScores.push({ name: p.name, score: p.final_score, date: d });
      });
    });

    const top5 = [...allScores].sort((a, b) => b.score - a.score).slice(0, 5);
    const bottom5 = [...allScores].sort((a, b) => a.score - b.score).slice(0, 5);

    // 連勝記録
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
  }, [effectiveGames]);

  // ── 相性マトリクス（直接対決pt差） ──
  const matrixData = useMemo(() => {
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
  }, [effectiveGames, matrixMembers]);

  // 全プレイヤー名リスト（セレクト用）
  const allPlayerNames = useMemo(() => {
    return gameStats.map((s) => s.name);
  }, [gameStats]);

  // 選択モーダル用のゲーム
  const selectedModalGame = useMemo(() => {
    if (!modalGameId) return null;
    return games.find((g) => g.game_id === modalGameId) || null;
  }, [modalGameId, games]);

  const selectedModalRounds = useMemo(() => {
    if (!modalGameId) return [];
    return rounds.filter((r) => r.game_id === modalGameId);
  }, [modalGameId, rounds]);

  return (
    <main className="min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-5 pb-16">
      {/* ─── ヘッダー ─── */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            成績集計・分析
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            クラウド同期データ（集計対象: {effectiveGames.length} 試合）
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-neutral-300 hover:text-white font-bold py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 transition-colors"
        >
          &larr; ホームへ戻る
        </Link>
      </header>

      {/* ─── 基本フィルターエリア ─── */}
      <section className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs">
        <div className="grid grid-cols-2 gap-2.5">
          {/* グループ選択 */}
          <div>
            <label className="text-[11px] font-black text-neutral-400 block mb-1">
              グループ
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="all">全グループ (全体)</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name}
                </option>
              ))}
            </select>
          </div>

          {/* ルール選択 */}
          <div>
            <label className="text-[11px] font-black text-neutral-400 block mb-1">
              ルール
            </label>
            <select
              value={selectedRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="all">全ルール (全体)</option>
              {rules.map((r) => (
                <option key={r.rule_id} value={r.rule_id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 items-center">
          {/* 集計年選択 */}
          <div>
            <label className="text-[11px] font-black text-neutral-400 block mb-1">
              集計期間
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="all">全期間</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </div>

          {/* ゲスト表示トグル */}
          <div className="pt-4 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-300">
              <input
                type="checkbox"
                checked={includeGuests}
                onChange={(e) => setIncludeGuests(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
              <span>ゲストも表示する</span>
            </label>
          </div>
        </div>

        {/* ─── アコーディオン: 試合IDで絞り込む（詳細フィルター） ─── */}
        <div className="border-t border-neutral-800 pt-2">
          <button
            type="button"
            onClick={() => setShowIdAccordion((prev) => !prev)}
            className="w-full text-left text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center justify-between py-1.5"
          >
            <span>
              試合IDで絞り込む（詳細フィルター）
              {selectedGameIds.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                  {selectedGameIds.length} 試合選択中
                </span>
              )}
            </span>
            <span>{showIdAccordion ? '▲ 閉じる' : '▼ 開く'}</span>
          </button>

          {showIdAccordion && (
            <div className="mt-2 p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              {/* クイック選択ボタン群 */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickSelect(1)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
                >
                  直近1試合
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(4)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
                >
                  直近4試合
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(8)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
                >
                  直近8試合
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(-1)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[11px] font-black"
                >
                  選択解除
                </button>
              </div>

              {/* 個別試合チェックボックス一覧 */}
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                {baseFilteredGames.map((g, idx) => {
                  const isSelected = selectedGameIds.includes(g.game_id);
                  const topP = g.participants[0]?.name || '不明';
                  return (
                    <label
                      key={g.game_id}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/10 text-white border border-amber-500/30'
                          : 'bg-neutral-900/80 text-neutral-400 hover:bg-neutral-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleGameId(g.game_id)}
                          className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                        />
                        <span>#{baseFilteredGames.length - idx}</span>
                        <span>{g.played_at.slice(5, 16).replace('T', ' ')}</span>
                      </div>
                      <span className="text-[11px] text-amber-300">
                        1位: {topP}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── 試合成績セクション ─── */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">試合成績</h2>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-bold">
            <span>並び順:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white font-bold"
            >
              <option value="totalPt">総合pt</option>
              <option value="okaNashiPt">オカなしpt</option>
              <option value="avgRank">平均順位</option>
              <option value="games">試合数</option>
            </select>
          </div>
        </div>

        {gameStats.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-900 rounded-xl border border-neutral-800">
            条件に一致する試合成績がありません。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-sm">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950 text-[11px] font-black text-neutral-400">
                  <th className="py-2.5 px-3">名前</th>
                  <th className="py-2.5 px-2 text-center">試合数</th>
                  <th className="py-2.5 px-2.5 text-right">総合pt</th>
                  <th className="py-2.5 px-2.5 text-right">オカなしpt</th>
                  <th className="py-2.5 px-2 text-center">平均順位</th>
                  <th className="py-2.5 px-2 text-center">連対率</th>
                  <th className="py-2.5 px-2 text-center">ラス回避率</th>
                  <th className="py-2.5 px-2 text-center">1着率</th>
                  <th className="py-2.5 px-2 text-center">2着率</th>
                  <th className="py-2.5 px-2 text-center">3着率</th>
                  <th className="py-2.5 px-2 text-center">4着率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {gameStats.map((s) => (
                  <tr key={s.name} className="hover:bg-neutral-850/60 transition-colors">
                    <td className="py-2.5 px-3 font-black text-sm text-white">{s.name}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{s.games}</td>
                    <td className={`py-2.5 px-2.5 text-right font-black font-mono ${
                      s.totalPt > 0 ? 'text-cyan-400' : s.totalPt < 0 ? 'text-rose-500' : 'text-neutral-300'
                    }`}>
                      {s.totalPt > 0 ? `+${s.totalPt.toFixed(1)}` : s.totalPt.toFixed(1)}
                    </td>
                    <td className={`py-2.5 px-2.5 text-right font-bold font-mono ${
                      s.okaNashiPt > 0 ? 'text-cyan-400' : s.okaNashiPt < 0 ? 'text-rose-500' : 'text-neutral-400'
                    }`}>
                      {s.okaNashiPt > 0 ? `+${s.okaNashiPt.toFixed(1)}` : s.okaNashiPt.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-200">{s.avgRank.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{s.rentaiRate.toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{s.rasuAvoidRate.toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-center font-bold text-amber-300">{s.rank1Rate.toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-center font-bold text-cyan-300">{s.rank2Rate.toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{s.rank3Rate.toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-center font-bold text-rose-400">{s.rank4Rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 詳細成績テーブル (5タブ分割) ─── */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">
            詳細成績（詳細記録 {detailedGameCount} 試合）
          </h2>
        </div>

        {/* 5タブセレクター */}
        <div className="grid grid-cols-5 gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
          {[
            { id: 'basic', label: '基本' },
            { id: 'datan', label: '打点' },
            { id: 'syubi', label: '守備' },
            { id: 'riichi', label: '立直' },
            { id: 'furo', label: '副露' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDetailTab(tab.id as any)}
              className={`py-2 rounded-lg text-xs font-black transition-all ${
                activeDetailTab === tab.id
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {roundStats.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-900 rounded-xl border border-neutral-800">
            詳細局データがありません。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-sm">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950 text-[11px] font-black text-neutral-400">
                  <th className="py-2.5 px-3">名前</th>
                  {activeDetailTab === 'basic' && (
                    <>
                      <th className="py-2.5 px-2 text-center">局数</th>
                      <th className="py-2.5 px-2 text-center text-amber-300">和了率</th>
                      <th className="py-2.5 px-2 text-center">ツモ率</th>
                      <th className="py-2.5 px-2 text-center text-rose-400">放銃率</th>
                      <th className="py-2.5 px-2 text-center">和銃差</th>
                      <th className="py-2.5 px-2 text-center">テンパイ率</th>
                      <th className="py-2.5 px-2.5 text-right">ノーテン罰符</th>
                    </>
                  )}
                  {activeDetailTab === 'datan' && (
                    <>
                      <th className="py-2.5 px-2.5 text-right text-amber-300">平均和了</th>
                      <th className="py-2.5 px-2.5 text-right">立直平均打点</th>
                      <th className="py-2.5 px-2.5 text-right">副露平均打点</th>
                      <th className="py-2.5 px-2.5 text-right">ダマ平均打点</th>
                      <th className="py-2.5 px-2 text-center text-cyan-300">打点効率</th>
                    </>
                  )}
                  {activeDetailTab === 'syubi' && (
                    <>
                      <th className="py-2.5 px-2 text-center text-rose-400">放銃率</th>
                      <th className="py-2.5 px-2 text-center">被リーチ放銃率</th>
                      <th className="py-2.5 px-2 text-center">被副露放銃率</th>
                      <th className="py-2.5 px-2 text-center">被ダマ放銃率</th>
                      <th className="py-2.5 px-2.5 text-right text-rose-300">平均放銃</th>
                    </>
                  )}
                  {activeDetailTab === 'riichi' && (
                    <>
                      <th className="py-2.5 px-2 text-center text-amber-300">リーチ率</th>
                      <th className="py-2.5 px-2 text-center text-cyan-300">立直和了率</th>
                      <th className="py-2.5 px-2 text-center text-rose-400">立直放銃率</th>
                    </>
                  )}
                  {activeDetailTab === 'furo' && (
                    <>
                      <th className="py-2.5 px-2 text-center text-amber-300">副露率</th>
                      <th className="py-2.5 px-2 text-center text-cyan-300">副露和了率</th>
                      <th className="py-2.5 px-2 text-center text-rose-400">副露放銃率</th>
                      <th className="py-2.5 px-2 text-center">ダマ和了率</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {roundStats.map((r) => (
                  <tr key={r.name} className="hover:bg-neutral-850/60 transition-colors">
                    <td className="py-2.5 px-3 font-black text-sm text-white">{r.name}</td>
                    {activeDetailTab === 'basic' && (
                      <>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.kyokuCount}</td>
                        <td className="py-2.5 px-2 text-center font-black text-amber-300">{r.agariRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.tsumoRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-black text-rose-400">{r.houjuRate.toFixed(1)}%</td>
                        <td className={`py-2.5 px-2 text-center font-black font-mono ${
                          r.agariHoujuDiff > 0 ? 'text-cyan-400' : r.agariHoujuDiff < 0 ? 'text-rose-400' : 'text-neutral-300'
                        }`}>
                          {r.agariHoujuDiff > 0 ? `+${r.agariHoujuDiff.toFixed(1)}%` : `${r.agariHoujuDiff.toFixed(1)}%`}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.tenpaiRate.toFixed(1)}%</td>
                        <td className={`py-2.5 px-2.5 text-right font-mono font-bold ${
                          r.notenBappu > 0 ? 'text-cyan-400' : r.notenBappu < 0 ? 'text-rose-400' : 'text-neutral-400'
                        }`}>
                          {r.notenBappu > 0 ? `+${r.notenBappu}` : r.notenBappu}
                        </td>
                      </>
                    )}
                    {activeDetailTab === 'datan' && (
                      <>
                        <td className="py-2.5 px-2.5 text-right font-black font-mono text-amber-300">{r.avgAgari.toLocaleString()}</td>
                        <td className="py-2.5 px-2.5 text-right font-bold font-mono text-neutral-300">{r.riichiAvgAgari.toLocaleString()}</td>
                        <td className="py-2.5 px-2.5 text-right font-bold font-mono text-neutral-300">{r.furoAvgAgari.toLocaleString()}</td>
                        <td className="py-2.5 px-2.5 text-right font-bold font-mono text-neutral-300">{r.damaAvgAgari.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-center font-black font-mono text-cyan-300">{r.efficiency.toFixed(2)}</td>
                      </>
                    )}
                    {activeDetailTab === 'syubi' && (
                      <>
                        <td className="py-2.5 px-2 text-center font-black text-rose-400">{r.houjuRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.riichiHoujuRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.furoHoujuRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.damaHoujuRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2.5 text-right font-black font-mono text-rose-300">{r.avgHouju.toLocaleString()}</td>
                      </>
                    )}
                    {activeDetailTab === 'riichi' && (
                      <>
                        <td className="py-2.5 px-2 text-center font-black text-amber-300">{r.riichiRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-black text-cyan-300">{r.riichiAgariRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-400">{r.riichiHoujuRate2.toFixed(1)}%</td>
                      </>
                    )}
                    {activeDetailTab === 'furo' && (
                      <>
                        <td className="py-2.5 px-2 text-center font-black text-amber-300">{r.furoRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-black text-cyan-300">{r.furoAgariRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-400">{r.furoHoujuRate2.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.damaAgariRate.toFixed(1)}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 総合ポイント推移グラフ ─── */}
      <section className="flex flex-col gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xs">
        <h2 className="text-base font-black text-white">総合ポイント推移</h2>

        {/* プレイヤー選択チップ */}
        <div>
          <span className="text-[11px] font-black text-neutral-400 block mb-1.5">表示メンバー</span>
          <div className="flex flex-wrap gap-1.5">
            {allPlayerNames.map((name) => {
              const active = chartMembers.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setChartMembers((prev) =>
                      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    active
                      ? 'bg-amber-500 text-black shadow-xs'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* SVG折れ線グラフ */}
        {chartMembers.length === 0 || chartData.length <= 1 ? (
          <div className="h-44 flex items-center justify-center text-neutral-500 text-xs font-bold">
            表示対象のメンバーを選択してください。
          </div>
        ) : (
          <div className="w-full overflow-x-auto pt-2">
            {(() => {
              // スケール計算
              let minPt = 0;
              let maxPt = 0;
              chartData.forEach((d) => {
                chartMembers.forEach((m) => {
                  const val = d.values[m] || 0;
                  if (val < minPt) minPt = val;
                  if (val > maxPt) maxPt = val;
                });
              });

              const range = Math.max(1, maxPt - minPt);
              const width = Math.max(340, chartData.length * 36);
              const height = 180;
              const padding = { top: 20, bottom: 30, left: 45, right: 20 };
              const plotW = width - padding.left - padding.right;
              const plotH = height - padding.top - padding.bottom;

              const getY = (val: number) => padding.top + plotH - ((val - minPt) / range) * plotH;
              const getX = (idx: number) => padding.left + (idx / (chartData.length - 1)) * plotW;
              const zeroY = getY(0);

              const colors = ['#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6', '#3b82f6'];

              return (
                <svg width={width} height={height} className="bg-neutral-950 rounded-xl border border-neutral-850">
                  {/* 0pt 基準線 */}
                  {minPt <= 0 && maxPt >= 0 && (
                    <line
                      x1={padding.left}
                      y1={zeroY}
                      x2={width - padding.right}
                      y2={zeroY}
                      stroke="#404040"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* 軸ラベル */}
                  <text x={padding.left - 6} y={getY(maxPt) + 4} textAnchor="end" fill="#737373" fontSize="10" fontWeight="bold">
                    {maxPt > 0 ? `+${maxPt.toFixed(0)}` : maxPt.toFixed(0)}
                  </text>
                  <text x={padding.left - 6} y={zeroY + 4} textAnchor="end" fill="#a3a3a3" fontSize="10" fontWeight="bold">
                    0
                  </text>
                  <text x={padding.left - 6} y={getY(minPt) + 4} textAnchor="end" fill="#737373" fontSize="10" fontWeight="bold">
                    {minPt.toFixed(0)}
                  </text>

                  {/* 各プレイヤーの折れ線 */}
                  {chartMembers.map((m, mIdx) => {
                    const color = colors[mIdx % colors.length];
                    const pts = chartData
                      .map((d, idx) => `${getX(idx)},${getY(d.values[m] || 0)}`)
                      .join(' ');

                    return (
                      <g key={m}>
                        <polyline
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          points={pts}
                        />
                        {/* 最終点 */}
                        {chartData.length > 0 && (
                          <circle
                            cx={getX(chartData.length - 1)}
                            cy={getY(chartData[chartData.length - 1].values[m] || 0)}
                            r="4"
                            fill={color}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {/* 凡例 */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {chartMembers.map((m, idx) => {
                const colors = ['#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6', '#3b82f6'];
                const color = colors[idx % colors.length];
                const lastVal = chartData[chartData.length - 1]?.values[m] || 0;
                return (
                  <div key={m} className="flex items-center gap-1.5 text-xs font-black">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-white">{m}</span>
                    <span className={lastVal > 0 ? 'text-cyan-400' : lastVal < 0 ? 'text-rose-400' : 'text-neutral-400'}>
                      ({lastVal > 0 ? `+${lastVal.toFixed(1)}` : lastVal.toFixed(1)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── レコード ─── */}
      <section className="flex flex-col gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xs">
        <h2 className="text-base font-black text-white">レコード</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 最高・最低スコア Top5 */}
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-[11px] font-black text-amber-300 block mb-1.5">
                最高スコア Top5
              </span>
              <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {records.top5.map((r, i) => (
                      <tr key={i} className="border-b border-neutral-850 last:border-0">
                        <td className="py-1.5 px-2.5 font-bold text-neutral-400 w-6">{i + 1}</td>
                        <td className="py-1.5 px-2 font-black text-white">{r.name}</td>
                        <td className="py-1.5 px-2 text-right font-black font-mono text-amber-300">{r.score.toLocaleString()} 点</td>
                        <td className="py-1.5 px-2 text-right text-[10px] text-neutral-500 font-mono">{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-black text-rose-400 block mb-1.5">
                最低スコア Top5
              </span>
              <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {records.bottom5.map((r, i) => (
                      <tr key={i} className="border-b border-neutral-850 last:border-0">
                        <td className="py-1.5 px-2.5 font-bold text-neutral-400 w-6">{i + 1}</td>
                        <td className="py-1.5 px-2 font-black text-white">{r.name}</td>
                        <td className="py-1.5 px-2 text-right font-black font-mono text-rose-400">{r.score.toLocaleString()} 点</td>
                        <td className="py-1.5 px-2 text-right text-[10px] text-neutral-500 font-mono">{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 連勝記録 */}
          <div>
            <span className="text-[11px] font-black text-cyan-300 block mb-1.5">
              連勝記録（2連勝以上）
            </span>
            {records.streaks.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
                2連勝以上の記録はまだありません。
              </div>
            ) : (
              <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 font-black">
                      <th className="py-1.5 px-3">名前</th>
                      <th className="py-1.5 px-3 text-right">最大連勝</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.streaks.map((s, i) => (
                      <tr key={i} className="border-b border-neutral-850 last:border-0">
                        <td className="py-1.5 px-3 font-black text-white">{s.name}</td>
                        <td className="py-1.5 px-3 text-right font-black font-mono text-cyan-300">
                          {s.maxStreak} 連勝
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── 相性マトリクス（直接対決） ─── */}
      <section className="flex flex-col gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-white">相性マトリクス（直接対決）</h2>
          <p className="text-[11px] text-neutral-400 font-bold mt-0.5">
            行: 自分 / 列: 相手（同卓時のpt差合計） 青: 得意 / 赤: 苦手
          </p>
        </div>

        {/* 分析対象セレクター */}
        <div>
          <span className="text-[11px] font-black text-neutral-400 block mb-1.5">分析対象メンバー</span>
          <div className="flex flex-wrap gap-1.5">
            {allPlayerNames.map((name) => {
              const active = matrixMembers.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setMatrixMembers((prev) =>
                      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    active
                      ? 'bg-amber-500 text-black shadow-xs'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {matrixMembers.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
            分析対象メンバーを選択してください。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-[11px] font-black text-neutral-400 bg-neutral-900/60">
                  <th className="py-2 px-3">自分 \ 相手</th>
                  {matrixMembers.map((m) => (
                    <th key={m} className="py-2 px-2.5 text-center">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {matrixMembers.map((m1) => (
                  <tr key={m1}>
                    <td className="py-2 px-3 font-black text-white bg-neutral-900/30">{m1}</td>
                    {matrixMembers.map((m2) => {
                      if (m1 === m2) {
                        return (
                          <td key={m2} className="py-2 px-2.5 text-center text-neutral-600 font-mono">
                            -
                          </td>
                        );
                      }
                      const diff = matrixData.get(m1)?.get(m2) || 0;
                      return (
                        <td
                          key={m2}
                          className={`py-2 px-2.5 text-center font-black font-mono ${
                            diff > 0
                              ? 'text-cyan-400 bg-cyan-950/20'
                              : diff < 0
                              ? 'text-rose-400 bg-rose-950/20'
                              : 'text-neutral-400'
                          }`}
                        >
                          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 対局履歴（ルール列なし、連動絞り込み） ─── */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">対局履歴</h2>
          <span className="text-xs text-neutral-400 font-bold">
            全 {effectiveGames.length} 試合
          </span>
        </div>

        {effectiveGames.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-900 rounded-xl border border-neutral-800">
            表示可能な対局履歴がありません。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-sm">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950 text-[11px] font-black text-neutral-400">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-2.5">日付</th>
                  <th className="py-2.5 px-2.5 text-amber-300">1位</th>
                  <th className="py-2.5 px-2.5 text-cyan-300">2位</th>
                  <th className="py-2.5 px-2.5 text-neutral-300">3位</th>
                  <th className="py-2.5 px-2.5 text-rose-400">4位</th>
                  <th className="py-2.5 px-2 text-center">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {effectiveGames.map((g, idx) => {
                  const pSorted = [...g.participants].sort((a, b) => a.rank - b.rank);
                  const p1 = pSorted[0];
                  const p2 = pSorted[1];
                  const p3 = pSorted[2];
                  const p4 = pSorted[3];

                  return (
                    <tr
                      key={g.game_id}
                      className="hover:bg-neutral-850/60 transition-colors cursor-pointer"
                      onClick={() => setModalGameId(g.game_id)}
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-neutral-500">
                        {effectiveGames.length - idx}
                      </td>
                      <td className="py-2.5 px-2.5 font-bold text-neutral-300 font-mono text-[11px]">
                        {g.played_at ? g.played_at.slice(0, 10) : '日付不明'}
                      </td>
                      <td className="py-2.5 px-2.5 font-black text-amber-300">
                        {p1 ? `${p1.name} (${p1.point > 0 ? '+' : ''}${p1.point.toFixed(1)})` : '-'}
                      </td>
                      <td className="py-2.5 px-2.5 font-bold text-cyan-300">
                        {p2 ? `${p2.name} (${p2.point > 0 ? '+' : ''}${p2.point.toFixed(1)})` : '-'}
                      </td>
                      <td className="py-2.5 px-2.5 font-bold text-neutral-300">
                        {p3 ? `${p3.name} (${p3.point > 0 ? '+' : ''}${p3.point.toFixed(1)})` : '-'}
                      </td>
                      <td className="py-2.5 px-2.5 font-bold text-rose-400">
                        {p4 ? `${p4.name} (${p4.point > 0 ? '+' : ''}${p4.point.toFixed(1)})` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-black"
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 対局詳細モーダル ─── */}
      {selectedModalGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">対局詳細</h3>
                <p className="text-xs text-neutral-400 font-bold mt-0.5">
                  {selectedModalGame.played_at.slice(0, 16).replace('T', ' ')} / {selectedModalGame.rule_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalGameId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* 最終順位 */}
            <div>
              <span className="text-xs font-black text-neutral-400 block mb-1.5">最終成績</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {selectedModalGame.participants.map((p) => (
                  <div key={p.seat} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col">
                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400">
                      <span>{p.rank}位</span>
                      <span>{p.final_score.toLocaleString()}点</span>
                    </div>
                    <span className="text-sm font-black text-white mt-1">{p.name}</span>
                    <span className={`text-xs font-black font-mono mt-0.5 ${
                      p.point > 0 ? 'text-cyan-400' : p.point < 0 ? 'text-rose-500' : 'text-neutral-300'
                    }`}>
                      {p.point > 0 ? `+${p.point.toFixed(1)}` : p.point.toFixed(1)} pt
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 各局詳細 */}
            <div>
              <span className="text-xs font-black text-neutral-400 block mb-1.5">
                局履歴（全 {selectedModalRounds.length} 局）
              </span>
              {selectedModalRounds.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
                  詳細局データがありません。
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {selectedModalRounds.map((r, idx) => (
                    <div key={r.round_id || idx} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                      <div className="flex items-center justify-between font-black">
                        <span className="text-white">{r.kyoku_name} {r.honba > 0 && `(${r.honba}本場)`}</span>
                        <span className="text-amber-400">
                          {r.result_type === 'tsumo' ? 'ツモ和了' : r.result_type === 'ron' ? 'ロン和了' : '流局'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalGameId(null)}
              className="w-full h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-black transition-colors mt-1"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ─── 最下部ホーム戻るボタン ─── */}
      <footer className="pt-3 pb-6 flex justify-center">
        <Link
          href="/"
          className="h-12 px-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] border border-neutral-800 text-neutral-300 hover:text-white font-black text-xs transition-all flex items-center justify-center shadow-xs"
        >
          &larr; ホーム画面へ戻る
        </Link>
      </footer>
    </main>
  );
}
