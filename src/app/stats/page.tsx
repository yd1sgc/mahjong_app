/**
 * 成績集計画面 (/stats)
 * mahjong_personal の stats.py / calc.py 完全準拠
 * 各種集計ロジックおよびUIをコンポーネント分割してスリム化
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MemberRow, RuleTemplateRow } from '@/types/database';
import {
  GameData,
  RoundData,
  calculateGameStats,
  calculateRoundStats,
  calculateChartData,
  calculateRecords,
  calculateCompatibilityMatrix,
} from '@/lib/mahjong/statsCalc';
import { GameFilterAccordion } from '@/components/stats/GameFilterAccordion';
import { GameStatsTable } from '@/components/stats/GameStatsTable';
import { StatsDetailsTab } from '@/components/stats/StatsDetailsTab';
import { ScoreTrendChart } from '@/components/stats/ScoreTrendChart';
import { StatsRecords } from '@/components/stats/StatsRecords';
import { CompatibilityMatrix } from '@/components/stats/CompatibilityMatrix';
import { GameHistoryTable } from '@/components/stats/GameHistoryTable';
import { GameDetailModal } from '@/components/stats/GameDetailModal';

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

        const gamesList = gData || [];
        const partList = pData || [];
        const roundsList = rData || [];
        const seatsList = sData || [];

        // GameData へマッピング
        const mappedGames: GameData[] = gamesList.map((g: any) => {
          const parts = partList
            .filter((p: any) => p.game_id === g.game_id)
            .sort((a: any, b: any) => a.seat - b.seat)
            .map((p: any) => ({
              seat: p.seat,
              member_id: p.member_id,
              name: p.player_name_snapshot || '不明',
              final_score: p.final_score,
              rank: p.rank,
              point: Number(p.point),
            }));

          return {
            game_id: g.game_id,
            played_at: g.played_at || '',
            group_id: g.group_id,
            rule_id: g.rule_id || '',
            rule_name: g.rule_name_snapshot || '標準ルール',
            rule_config: g.rule_config_snapshot || {},
            participants: parts,
          };
        });

        // RoundData へマッピング
        const mappedRounds: RoundData[] = roundsList.map((r: any) => {
          const seats = seatsList
            .filter((s: any) => s.round_id === r.round_id)
            .sort((a: any, b: any) => a.seat - b.seat)
            .map((s: any) => ({
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
      return baseFilteredGames;
    }
    return baseFilteredGames.filter((g) => selectedGameIds.includes(g.game_id));
  }, [baseFilteredGames, selectedGameIds]);

  // クイック選択ハンドラー
  const handleQuickSelect = (count: number) => {
    if (count === -1) {
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

  // ── 試合成績集計 ──
  const gameStats = useMemo(() => {
    return calculateGameStats(effectiveGames, sortBy);
  }, [effectiveGames, sortBy]);

  // 初期グラフ・マトリクス対象プレイヤーの設定
  useEffect(() => {
    if (gameStats.length > 0 && chartMembers.length === 0) {
      setChartMembers(gameStats.slice(0, Math.min(5, gameStats.length)).map((s) => s.name));
    }
    if (gameStats.length > 0 && matrixMembers.length === 0) {
      setMatrixMembers(gameStats.slice(0, Math.min(5, gameStats.length)).map((s) => s.name));
    }
  }, [gameStats, chartMembers.length, matrixMembers.length]);

  // ── 詳細成績（5タブ用）集計 ──
  const { roundStats, detailedGameCount } = useMemo(() => {
    return calculateRoundStats(effectiveGames, rounds);
  }, [effectiveGames, rounds]);

  // ── 総合ポイント推移グラフデータ ──
  const chartData = useMemo(() => {
    return calculateChartData(effectiveGames, chartMembers);
  }, [effectiveGames, chartMembers]);

  // ── レコード（最高Top5、最低Top5、連勝記録） ──
  const records = useMemo(() => {
    return calculateRecords(effectiveGames);
  }, [effectiveGames]);

  // ── 相性マトリクス ──
  const matrixData = useMemo(() => {
    return calculateCompatibilityMatrix(effectiveGames, matrixMembers);
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
    <main className="w-full min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-5 pb-16">
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

        {/* 試合ID詳細フィルター（アコーディオン） */}
        <GameFilterAccordion
          baseFilteredGames={baseFilteredGames}
          selectedGameIds={selectedGameIds}
          onToggleGameId={handleToggleGameId}
          onQuickSelect={handleQuickSelect}
          onClearSelection={handleClearSelection}
        />
      </section>

      {/* ─── 試合成績セクション ─── */}
      <GameStatsTable
        gameStats={gameStats}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {/* ─── 詳細成績テーブル (5タブ分割) ─── */}
      <StatsDetailsTab
        roundStats={roundStats}
        detailedGameCount={detailedGameCount}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
      />

      {/* ─── 総合ポイント推移グラフ ─── */}
      <ScoreTrendChart
        allPlayerNames={allPlayerNames}
        chartMembers={chartMembers}
        setChartMembers={setChartMembers}
        chartData={chartData}
      />

      {/* ─── レコード ─── */}
      <StatsRecords records={records} />

      {/* ─── 相性マトリクス（直接対決） ─── */}
      <CompatibilityMatrix
        allPlayerNames={allPlayerNames}
        matrixMembers={matrixMembers}
        setMatrixMembers={setMatrixMembers}
        matrixData={matrixData}
      />

      {/* ─── 対局履歴 ─── */}
      <GameHistoryTable
        effectiveGames={effectiveGames}
        onSelectGame={(id) => setModalGameId(id)}
      />

      {/* ─── 対局詳細モーダル ─── */}
      <GameDetailModal
        game={selectedModalGame}
        rounds={selectedModalRounds}
        onClose={() => setModalGameId(null)}
      />

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
