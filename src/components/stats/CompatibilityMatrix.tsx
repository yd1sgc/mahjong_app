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
  // 表示中メンバー間の最大絶対値差分（グラデーション濃淡スケール用: coolwarm_r仕様）
  const maxAbsDiff = React.useMemo(() => {
    let max = 0;
    for (const m1 of matrixMembers) {
      for (const m2 of matrixMembers) {
        if (m1 === m2) continue;
        const diff = Math.abs(matrixData.get(m1)?.get(m2) || 0);
        if (diff > max) max = diff;
      }
    }
    return Math.max(max, 1.0);
  }, [matrixMembers, matrixData]);

  // 大差セルのハイライト判定用（最大絶対値の45%以上をバッジ強調）
  const renderCellContent = (diff: number) => {
    if (diff === 0) {
      return <span className="text-neutral-500 font-mono font-bold">0.0</span>;
    }

    const factor = Math.abs(diff) / maxAbsDiff;
    const isHighlight = factor >= 0.45;

    if (diff > 0) {
      const text = `+${diff.toFixed(1)}`;
      if (isHighlight) {
        return (
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-black font-mono text-[11px] shadow-xs">
            {text}
          </span>
        );
      }
      return <span className="text-cyan-400 font-black font-mono text-xs">{text}</span>;
    } else {
      const text = diff.toFixed(1);
      if (isHighlight) {
        return (
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-rose-950/80 border border-rose-700/60 text-rose-300 font-black font-mono text-[11px] shadow-xs">
            {text}
          </span>
        );
      }
      return <span className="text-rose-400 font-black font-mono text-xs">{text}</span>;
    }
  };

  return (
    <section className="flex flex-col gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xs">
      <div>
        <h2 className="text-base font-black text-white">相性マトリクス</h2>
        <p className="text-[11px] text-neutral-400 font-bold mt-0.5">
          行: 自分 / 列: 相手（同卓pt差）
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
              <tr className="border-b border-neutral-800 text-[11px] font-black text-neutral-400 bg-neutral-900/80">
                <th className="py-2.5 px-3 whitespace-nowrap sticky left-0 z-20 bg-neutral-900 border-r border-neutral-800 shadow-[1px_0_0_0_rgba(38,38,38,1)]">
                  自分 \ 相手
                </th>
                {matrixMembers.map((m) => (
                  <th key={m} className="py-2.5 px-2 text-center whitespace-nowrap min-w-[4.25rem]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {matrixMembers.map((m1) => (
                <tr key={m1} className="hover:bg-neutral-900/40 transition-colors">
                  <td className="py-2.5 px-3 font-black text-white whitespace-nowrap sticky left-0 z-10 bg-neutral-900 border-r border-neutral-800 shadow-[1px_0_0_0_rgba(38,38,38,1)]">
                    {m1}
                  </td>
                  {matrixMembers.map((m2) => {
                    if (m1 === m2) {
                      return (
                        <td key={m2} className="py-2.5 px-2 text-center text-neutral-600 font-mono whitespace-nowrap min-w-[4.25rem]">
                          -
                        </td>
                      );
                    }
                    const diff = matrixData.get(m1)?.get(m2) || 0;
                    return (
                      <td key={m2} className="py-2.5 px-2 text-center whitespace-nowrap min-w-[4.25rem]">
                        {renderCellContent(diff)}
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
