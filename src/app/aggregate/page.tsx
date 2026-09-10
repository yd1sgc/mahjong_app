/**
 * 合計集計画面（/aggregate）
 * 選択試合の合計ポイント計算、直近N試合選択、ゼロ和検算（合計0.0pt確認）特化UI
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GameRow, GameParticipantRow } from '@/types/database';

interface GameItem {
  game_id: string;
  played_at: string;
  rule_name: string;
  participants: {
    name: string;
    rank: number;
    point: number;
    score: number;
  }[];
}

interface PlayerAggregate {
  name: string;
  games: number;
  totalPt: number;
  avgRank: number;
  ranks: [number, number, number, number];
}

export default function AggregatePage() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGameList, setShowGameList] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // games 取得 (played_at 降順)
        const { data: gData } = await supabase
          .from('games')
          .select('*')
          .order('played_at', { ascending: false });

        // game_participants 取得
        const { data: pData } = await supabase
          .from('game_participants')
          .select('*');

        const gList: GameRow[] = (gData as any[]) || [];
        const pList: GameParticipantRow[] = (pData as any[]) || [];

        const mapped: GameItem[] = gList.map((g) => {
          const parts = pList
            .filter((p) => p.game_id === g.game_id)
            .sort((a, b) => a.rank - b.rank)
            .map((p) => ({
              name: p.player_name_snapshot,
              rank: p.rank,
              point: Number(p.point),
              score: p.final_score,
            }));

          return {
            game_id: g.game_id,
            played_at: g.played_at || '',
            rule_name: g.rule_name_snapshot || '標準ルール',
            participants: parts,
          };
        });

        setGames(mapped);

        // 初期選択: 直近4試合（または存在する全試合）
        const initialCount = Math.min(4, mapped.length);
        const initialSelected = mapped.slice(0, initialCount).map((g) => g.game_id);
        setSelectedGameIds(initialSelected);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 直近N試合選択
  const handleSelectRecent = (n: number) => {
    if (n === -1) {
      // 全試合
      setSelectedGameIds(games.map((g) => g.game_id));
    } else {
      setSelectedGameIds(games.slice(0, n).map((g) => g.game_id));
    }
  };

  // 全解除
  const handleClear = () => {
    setSelectedGameIds([]);
  };

  // 個別チェック切り替え
  const handleToggleGame = (id: string) => {
    setSelectedGameIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  // 選択試合に基づく集計計算
  const selectedGames = games.filter((g) => selectedGameIds.includes(g.game_id));

  const playerMap = new Map<string, PlayerAggregate>();

  for (const g of selectedGames) {
    for (const p of g.participants) {
      if (!playerMap.has(p.name)) {
        playerMap.set(p.name, {
          name: p.name,
          games: 0,
          totalPt: 0,
          avgRank: 0,
          ranks: [0, 0, 0, 0],
        });
      }
      const item = playerMap.get(p.name)!;
      item.games += 1;
      item.totalPt += p.point;
      if (p.rank >= 1 && p.rank <= 4) {
        item.ranks[p.rank - 1] += 1;
      }
    }
  }

  const aggregatedPlayers: PlayerAggregate[] = Array.from(playerMap.values())
    .map((p) => ({
      ...p,
      avgRank:
        p.games > 0
          ? (p.ranks[0] * 1 + p.ranks[1] * 2 + p.ranks[2] * 3 + p.ranks[3] * 4) / p.games
          : 0,
    }))
    .sort((a, b) => b.totalPt - a.totalPt);

  // 合計ポイント検算（ゼロ和チェック）
  const totalPtSum = aggregatedPlayers.reduce((sum, p) => sum + p.totalPt, 0);
  const isZeroSumValid = Math.abs(totalPtSum) < 0.05;

  return (
    <main className="w-full min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-4">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            合計集計
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            選択した試合のポイント合計 ＆ 検算
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-neutral-300 hover:text-white font-bold py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 transition-colors"
        >
          &larr; ホームへ戻る
        </Link>
      </header>

      {/* 試合選択コントロール */}
      <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-neutral-300">
            集計対象の試合を選択
          </span>
          <span className="text-xs font-black px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            選択中: {selectedGameIds.length} 試合
          </span>
        </div>

        {/* 直近試合数セレクター ＆ 解除ボタン */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 shrink-0">直近:</span>
            <select
              defaultValue="4"
              onChange={(e) => handleSelectRecent(Number(e.target.value))}
              className="w-full bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
            >
              <option value="1" className="bg-neutral-900 text-white">直近 1 試合</option>
              <option value="2" className="bg-neutral-900 text-white">直近 2 試合</option>
              <option value="3" className="bg-neutral-900 text-white">直近 3 試合</option>
              <option value="4" className="bg-neutral-900 text-white">直近 4 試合</option>
              <option value="5" className="bg-neutral-900 text-white">直近 5 試合</option>
              <option value="6" className="bg-neutral-900 text-white">直近 6 試合</option>
              <option value="8" className="bg-neutral-900 text-white">直近 8 試合</option>
              <option value="10" className="bg-neutral-900 text-white">直近 10 試合</option>
              <option value="12" className="bg-neutral-900 text-white">直近 12 試合</option>
              <option value="16" className="bg-neutral-900 text-white">直近 16 試合</option>
              <option value="20" className="bg-neutral-900 text-white">直近 20 試合</option>
              <option value="-1" className="bg-neutral-900 text-white">全試合 ({games.length})</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="h-10 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-300 hover:text-white text-xs font-black transition-colors shrink-0"
          >
            選択解除
          </button>
        </div>

        {/* 試合個別選択リスト (アコーディオン) */}
        <div className="border-t border-neutral-800/80 pt-2">
          <button
            type="button"
            onClick={() => setShowGameList((prev) => !prev)}
            className="w-full text-left text-xs font-bold text-neutral-400 hover:text-neutral-200 flex items-center justify-between py-1"
          >
            <span>個別の試合を選んで調整する</span>
            <span>{showGameList ? '▲ 閉じる' : '▼ 一覧を表示'}</span>
          </button>

          {showGameList && (
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto mt-2 p-1.5 bg-neutral-950 rounded-xl border border-neutral-800">
              {games.map((g, idx) => {
                const isSelected = selectedGameIds.includes(g.game_id);
                const topPlayer = g.participants[0]?.name || '不明';

                return (
                  <label
                    key={g.game_id}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 text-white border border-amber-500/30'
                        : 'bg-neutral-900/80 text-neutral-400 hover:bg-neutral-850'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleGame(g.game_id)}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                      <span>#{games.length - idx}</span>
                      <span>{g.played_at.slice(5, 16).replace('T', ' ')}</span>
                      <span className="text-[11px] text-neutral-500">{g.rule_name}</span>
                    </div>
                    <span className="text-[11px] text-amber-300">
                      1位: {topPlayer}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── メイン集計テーブル（最重要: 名前・試合数・合計ポイント・ゼロ和検算） ─── */}
      <section className="flex flex-col gap-2.5">
        {/* 検算ステータスバー */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            isZeroSumValid
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isZeroSumValid ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
              }`}
            ></span>
            <span className="text-xs font-black">
              {isZeroSumValid
                ? '精算検算: 正常（ゼロサム成立）'
                : '精算検算: 不整合（合計が0になりません）'}
            </span>
          </div>

          <span className="text-base font-black font-mono">
            合計: {totalPtSum > 0 ? `+${totalPtSum.toFixed(1)}` : totalPtSum.toFixed(1)} pt
          </span>
        </div>

        {/* メインテーブル */}
        {loading ? (
          <div className="p-8 text-center text-neutral-500 text-xs font-bold">
            集計中...
          </div>
        ) : selectedGames.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-xs font-bold bg-neutral-900 rounded-xl border border-neutral-800">
            試合が選択されていません。上部で試合数を選択してください。
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/80 text-[11px] font-black text-neutral-400">
                  <th className="py-3 px-3 text-center w-10">順</th>
                  <th className="py-3 px-3">名前</th>
                  <th className="py-3 px-3 text-center">試合数</th>
                  <th className="py-3 px-4 text-right">合計ポイント</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {aggregatedPlayers.map((p, idx) => (
                  <tr key={p.name} className="hover:bg-neutral-850/60 transition-colors">
                    <td className="py-3 px-3 text-center text-xs font-black text-neutral-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 font-black text-base text-white">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 text-center text-xs font-bold text-neutral-300">
                      {p.games} 試合
                    </td>
                    <td
                      className={`py-3 px-4 text-right text-lg font-black font-mono ${
                        p.totalPt > 0
                          ? 'text-cyan-400'
                          : p.totalPt < 0
                          ? 'text-rose-500'
                          : 'text-neutral-300'
                      }`}
                    >
                      {p.totalPt > 0 ? `+${p.totalPt.toFixed(1)}` : p.totalPt.toFixed(1)} pt
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-700 bg-neutral-950 font-black text-sm">
                  <td colSpan={2} className="py-3 px-3 text-neutral-300">
                    合計検算
                  </td>
                  <td className="py-3 px-3 text-center text-neutral-300">
                    延べ {aggregatedPlayers.reduce((s, p) => s + p.games, 0)} 枠
                  </td>
                  <td
                    className={`py-3 px-4 text-right text-base font-mono ${
                      isZeroSumValid ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {totalPtSum > 0 ? `+${totalPtSum.toFixed(1)}` : totalPtSum.toFixed(1)} pt
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ─── サブ情報: 平均順位・着順内訳（下部に配置） ─── */}
      {selectedGames.length > 0 && (
        <section className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="w-full text-left text-xs font-bold text-neutral-400 hover:text-white flex items-center justify-between py-1"
          >
            <span>平均順位 ＆ 着順内訳の詳細を見る</span>
            <span>{showDetails ? '▲ 閉じる' : '▼ 詳細を表示'}</span>
          </button>

          {showDetails && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500 text-[10px]">
                    <th className="py-2 px-2">名前</th>
                    <th className="py-2 px-2 text-center">平均順位</th>
                    <th className="py-2 px-2 text-center text-amber-300">1着</th>
                    <th className="py-2 px-2 text-center text-cyan-300">2着</th>
                    <th className="py-2 px-2 text-center text-neutral-300">3着</th>
                    <th className="py-2 px-2 text-center text-rose-400">4着</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {aggregatedPlayers.map((p) => (
                    <tr key={p.name}>
                      <td className="py-2 px-2 font-bold text-white">{p.name}</td>
                      <td className="py-2 px-2 text-center font-bold text-neutral-300">
                        {p.avgRank.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-amber-300">{p.ranks[0]}</td>
                      <td className="py-2 px-2 text-center font-bold text-cyan-300">{p.ranks[1]}</td>
                      <td className="py-2 px-2 text-center font-bold text-neutral-300">{p.ranks[2]}</td>
                      <td className="py-2 px-2 text-center font-bold text-rose-400">{p.ranks[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 最下部ホーム戻るボタン */}
      <footer className="pt-2 pb-6 flex justify-center">
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
