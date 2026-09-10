/**
 * 対局履歴テーブルコンポーネント (GameHistoryTable.tsx)
 * 試合一覧、1〜4位プレイヤーとpt、詳細モーダル表示ボタン
 */

'use client';

import React from 'react';
import { GameData } from '@/lib/mahjong/statsCalc';

interface GameHistoryTableProps {
  effectiveGames: GameData[];
  onSelectGame: (gameId: string) => void;
}

export const GameHistoryTable: React.FC<GameHistoryTableProps> = ({
  effectiveGames,
  onSelectGame,
}) => {
  return (
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
                    onClick={() => onSelectGame(g.game_id)}
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
  );
};
