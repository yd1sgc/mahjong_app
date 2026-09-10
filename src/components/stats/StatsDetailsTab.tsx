/**
 * 詳細成績（5タブ分割: 基本・打点・守備・立直・副露）テーブルコンポーネント (StatsDetailsTab.tsx)
 */

'use client';

import React from 'react';
import { RoundStatsRow } from '@/lib/mahjong/statsCalc';

interface StatsDetailsTabProps {
  roundStats: RoundStatsRow[];
  detailedGameCount: number;
  activeDetailTab: 'basic' | 'datan' | 'syubi' | 'riichi' | 'furo';
  setActiveDetailTab: (tab: 'basic' | 'datan' | 'syubi' | 'riichi' | 'furo') => void;
}

export const StatsDetailsTab: React.FC<StatsDetailsTabProps> = ({
  roundStats,
  detailedGameCount,
  activeDetailTab,
  setActiveDetailTab,
}) => {
  return (
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
                    <th className="py-2.5 px-2.5 text-right">供託収支</th>
                  </>
                )}
                {activeDetailTab === 'datan' && (
                  <>
                    <th className="py-2.5 px-2.5 text-right text-amber-300">平均和了</th>
                    <th className="py-2.5 px-2.5 text-right">立直平均打点</th>
                    <th className="py-2.5 px-2.5 text-right">副露平均打点</th>
                    <th className="py-2.5 px-2.5 text-right">ダマ平均打点</th>
                    <th className="py-2.5 px-2.5 text-center text-cyan-300">打点効率</th>
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
                        {`${r.agariHoujuDiff.toFixed(1)}%`}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-neutral-300">{r.tenpaiRate.toFixed(1)}%</td>
                      <td className={`py-2.5 px-2.5 text-right font-mono font-bold ${
                        r.notenBappu > 0 ? 'text-cyan-400' : r.notenBappu < 0 ? 'text-rose-400' : 'text-neutral-400'
                      }`}>
                        {r.notenBappu}
                      </td>
                      <td className={`py-2.5 px-2.5 text-right font-mono font-bold ${
                        r.kyotakuPoint > 0 ? 'text-cyan-400' : r.kyotakuPoint < 0 ? 'text-rose-400' : 'text-neutral-400'
                      }`}>
                        {r.kyotakuPoint}
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
  );
};
