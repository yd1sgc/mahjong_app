/**
 * 相性マトリクス（直接対決pt差）コンポーネント (CompatibilityMatrix.tsx)
 * 行: 自分 / 列: 相手（同卓時のpt差合計） 青: 得意 / 赤: 苦手
 */

'use client';

import React from 'react';

interface CompatibilityMatrixProps {
  allPlayerNames: string[];
  matrixMembers: string[];
  setMatrixMembers: React.Dispatch<React.SetStateAction<string[]>>;
  matrixData: Map<string, Map<string, number>>;
}

export const CompatibilityMatrix: React.FC<CompatibilityMatrixProps> = ({
  allPlayerNames,
  matrixMembers,
  setMatrixMembers,
  matrixData,
}) => {
  // 表示中メンバー間の最大絶対値差分（グラデーション濃淡スケール用）
  const maxAbsDiff = React.useMemo(() => {
    let max = 0;
    for (const m1 of matrixMembers) {
      for (const m2 of matrixMembers) {
        if (m1 === m2) continue;
        const diff = Math.abs(matrixData.get(m1)?.get(m2) || 0);
        if (diff > max) max = diff;
      }
    }
    return max;
  }, [matrixMembers, matrixData]);

  // pt差に応じたスタイル計算（青・赤の濃淡グラデーション）
  const getCellStyle = (diff: number) => {
    if (diff === 0 || maxAbsDiff === 0) {
      return {
        className: 'text-neutral-500 font-mono',
        style: undefined,
      };
    }
    // 0.12 〜 0.65 の範囲で背景濃淡を動的に付与
    const ratio = Math.min(1, Math.abs(diff) / maxAbsDiff);
    const alpha = (0.12 + ratio * 0.53).toFixed(2);

    if (diff > 0) {
      return {
        className: 'text-cyan-300 font-black font-mono',
        style: { backgroundColor: `rgba(6, 182, 212, ${alpha})` },
      };
    } else {
      return {
        className: 'text-rose-300 font-black font-mono',
        style: { backgroundColor: `rgba(244, 63, 94, ${alpha})` },
      };
    }
  };

  return (
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
              <tr className="border-b border-neutral-800 text-[11px] font-black text-neutral-400 bg-neutral-900">
                <th className="py-2.5 px-3 whitespace-nowrap sticky left-0 z-20 bg-neutral-900 border-r border-neutral-800 shadow-[1px_0_0_0_rgba(38,38,38,1)]">
                  自分 \ 相手
                </th>
                {matrixMembers.map((m) => (
                  <th key={m} className="py-2.5 px-3 text-center whitespace-nowrap min-w-[4.5rem]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {matrixMembers.map((m1) => (
                <tr key={m1} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="py-2 px-3 font-black text-white whitespace-nowrap sticky left-0 z-10 bg-neutral-900 border-r border-neutral-800 shadow-[1px_0_0_0_rgba(38,38,38,1)]">
                    {m1}
                  </td>
                  {matrixMembers.map((m2) => {
                    if (m1 === m2) {
                      return (
                        <td key={m2} className="py-2 px-2.5 text-center text-neutral-600 font-mono whitespace-nowrap min-w-[4.5rem] bg-neutral-950/60">
                          -
                        </td>
                      );
                    }
                    const diff = matrixData.get(m1)?.get(m2) || 0;
                    const cell = getCellStyle(diff);
                    return (
                      <td
                        key={m2}
                        className={`py-2 px-2.5 text-center whitespace-nowrap min-w-[4.5rem] transition-colors ${cell.className}`}
                        style={cell.style}
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
  );
};
