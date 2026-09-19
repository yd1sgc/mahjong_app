/**
 * レコード表示コンポーネント (StatsRecords.tsx)
 * 最高スコアTop5、最低スコアTop5、連勝記録（更新中含む）、役満記録
 */

'use client';

import React from 'react';
import { RecordsData } from '@/lib/mahjong/statsCalc';
import { YakumanDisplayItem } from '@/hooks/useStatsData';

interface StatsRecordsProps {
  records: RecordsData;
  yakumanRecords?: YakumanDisplayItem[];
}

const renderRankBadge = (rank: number) => {
  if (rank === 1) {
    return (
      <span className="w-4 h-4 rounded flex items-center justify-center font-black text-[10px] bg-white text-black shrink-0">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] bg-neutral-800 text-neutral-200 shrink-0">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] bg-neutral-800 text-neutral-400 shrink-0">
        3
      </span>
    );
  }
  return (
    <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] text-neutral-600 shrink-0">
      {rank}
    </span>
  );
};

export const StatsRecords: React.FC<StatsRecordsProps> = ({ records, yakumanRecords = [] }) => {
  return (
    <section className="flex flex-col gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xs">
      <h2 className="text-base font-black text-white">レコード</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* 最高・最低スコア */}
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-[11px] font-black text-neutral-400 block mb-1.5">
              最高スコア
            </span>
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <tbody>
                  {records.top5.map((r, i) => (
                    <tr key={i} className="border-b border-neutral-850 last:border-0">
                      <td className="py-1.5 px-2.5 w-7 text-center">
                        <div className="flex justify-center">{renderRankBadge(i + 1)}</div>
                      </td>
                      <td className="py-1.5 px-2 font-black text-white">{r.name}</td>
                      <td className="py-1.5 px-2 text-right font-black font-mono text-white">
                        {r.score.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-[10px] text-neutral-500 font-mono">
                        {r.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-black text-neutral-400 block mb-1.5">
              最低スコア
            </span>
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <tbody>
                  {records.bottom5.map((r, i) => (
                    <tr key={i} className="border-b border-neutral-850 last:border-0">
                      <td className="py-1.5 px-2.5 w-7 text-center">
                        <div className="flex justify-center">{renderRankBadge(i + 1)}</div>
                      </td>
                      <td className="py-1.5 px-2 font-black text-white">{r.name}</td>
                      <td className="py-1.5 px-2 text-right font-bold font-mono text-neutral-300">
                        {r.score.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-[10px] text-neutral-500 font-mono">
                        {r.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 連勝記録（案B: 上部に現在連勝中・最大5名 ＋ 下に歴代Top記録） */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-black text-neutral-400">連勝記録</span>
            <span className="text-[10px] text-neutral-500 font-mono">2連勝以上</span>
          </div>

          {/* ★案B: 現在更新中（activeStreaks: 最大5名） */}
          {records.activeStreaks && records.activeStreaks.length > 0 && (
            <div className="mb-2.5 p-2 rounded-xl bg-cyan-950/30 border border-cyan-800/50 space-y-1.5">
              {records.activeStreaks.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-cyan-500 text-neutral-950 rounded tracking-wide">
                      更新中
                    </span>
                    <span className="font-black text-white text-xs">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-cyan-400 font-black text-xs">{item.currentStreak}</span>
                    <span className="text-[10px] text-neutral-400 font-sans">連勝中</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 歴代連勝記録 */}
          {records.streaks.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
              記録がありません。
            </div>
          ) : (
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 font-black">
                    <th className="py-1.5 px-2.5 w-7 text-center">#</th>
                    <th className="py-1.5 px-2">名前</th>
                    <th className="py-1.5 px-2 text-right">連勝数</th>
                    <th className="py-1.5 px-2.5 text-right">達成日</th>
                  </tr>
                </thead>
                <tbody>
                  {records.streaks.map((s, i) => (
                    <tr key={i} className="border-b border-neutral-850 last:border-0">
                      <td className="py-1.5 px-2.5 w-7 text-center">
                        <div className="flex justify-center">{renderRankBadge(i + 1)}</div>
                      </td>
                      <td className="py-1.5 px-2 font-black text-white">{s.name}</td>
                      <td className="py-1.5 px-2 text-right font-black font-mono text-white">
                        {s.maxStreak} <span className="text-[10px] font-normal text-neutral-400">連勝</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-[10px] text-neutral-500 font-mono">
                        {s.achievedDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 役満記録 */}
        <div className="sm:col-span-2 pt-3 border-t border-neutral-800">
          <span className="text-[11px] font-black text-neutral-400 block mb-1.5">
            役満記録
          </span>
          {(!yakumanRecords || yakumanRecords.length === 0) ? (
            <div className="p-4 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
              役満の記録はありません。
            </div>
          ) : (
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 font-black">
                    <th className="py-2 px-3">和了日</th>
                    <th className="py-2 px-3">和了者</th>
                    <th className="py-2 px-3">役満名</th>
                    <th className="py-2 px-3 text-right">和了方式</th>
                  </tr>
                </thead>
                <tbody>
                  {yakumanRecords.map((yr, i) => (
                    <tr key={yr.id || i} className="border-b border-neutral-850 last:border-0 hover:bg-neutral-900/50 transition-colors">
                      <td className="py-2 px-3 text-[11px] text-neutral-400 font-mono whitespace-nowrap">
                        {yr.played_at}
                      </td>
                      <td className="py-2 px-3 font-black text-white whitespace-nowrap">
                        {yr.member_name}
                      </td>
                      <td className="py-2 px-3 font-black text-amber-400 text-xs">
                        {yr.yakuman_name}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-neutral-300 font-mono">
                        {yr.win_type_label}
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
  );
};
