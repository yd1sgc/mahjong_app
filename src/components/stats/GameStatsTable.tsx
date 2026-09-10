/**
 * 試合成績テーブルコンポーネント (GameStatsTable.tsx)
 * 総合pt、オカなしpt、平均順位、連対率、ラス回避率、順位割合
 */

'use client';

import React from 'react';
import { GameStatsRow } from '@/lib/mahjong/statsCalc';

interface GameStatsTableProps {
  gameStats: GameStatsRow[];
  sortBy: 'totalPt' | 'okaNashiPt' | 'avgRank' | 'games';
  setSortBy: (sortBy: 'totalPt' | 'okaNashiPt' | 'avgRank' | 'games') => void;
}

export const GameStatsTable: React.FC<GameStatsTableProps> = ({
  gameStats,
  sortBy,
  setSortBy,
}) => {
  return (
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
                  <td
                    className={`py-2.5 px-2.5 text-right font-black font-mono ${
                      s.totalPt > 0
                        ? 'text-cyan-400'
                        : s.totalPt < 0
                        ? 'text-rose-500'
                        : 'text-neutral-300'
                    }`}
                  >
                    {s.totalPt > 0 ? `+${s.totalPt.toFixed(1)}` : s.totalPt.toFixed(1)}
                  </td>
                  <td
                    className={`py-2.5 px-2.5 text-right font-bold font-mono ${
                      s.okaNashiPt > 0
                        ? 'text-cyan-400'
                        : s.okaNashiPt < 0
                        ? 'text-rose-500'
                        : 'text-neutral-400'
                    }`}
                  >
                    {s.okaNashiPt > 0 ? `+${s.okaNashiPt.toFixed(1)}` : s.okaNashiPt.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-neutral-200">
                    {s.avgRank.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-neutral-300">
                    {s.rentaiRate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-neutral-300">
                    {s.rasuAvoidRate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-amber-300">
                    {s.rank1Rate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-cyan-300">
                    {s.rank2Rate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-neutral-300">
                    {s.rank3Rate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-rose-400">
                    {s.rank4Rate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
