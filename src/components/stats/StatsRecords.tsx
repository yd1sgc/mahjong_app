/**
 * レコード表示コンポーネント (StatsRecords.tsx)
 * 最高スコアTop5、最低スコアTop5、連勝記録一覧
 */

'use client';

import React from 'react';
import { RecordsData } from '@/lib/mahjong/statsCalc';

interface StatsRecordsProps {
  records: RecordsData;
}

export const StatsRecords: React.FC<StatsRecordsProps> = ({ records }) => {
  return (
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
                      <td className="py-1.5 px-2 text-right font-black font-mono text-amber-300">
                        {r.score.toLocaleString()} 点
                      </td>
                      <td className="py-1.5 px-2 text-right text-[10px] text-neutral-500 font-mono">
                        {r.date}
                      </td>
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
                      <td className="py-1.5 px-2 text-right font-black font-mono text-rose-400">
                        {r.score.toLocaleString()} 点
                      </td>
                      <td className="py-1.5 px-2 text-right text-[10px] text-neutral-500 font-mono">
                        {r.date}
                      </td>
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
  );
};
