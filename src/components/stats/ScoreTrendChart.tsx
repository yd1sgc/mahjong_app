/**
 * 総合ポイント推移グラフコンポーネント (ScoreTrendChart.tsx)
 * 手書きSVG折れ線グラフ、プレイヤー選択チップ、ゼロ線・凡例表示
 */

'use client';

import React from 'react';

interface ScoreTrendChartProps {
  allPlayerNames: string[];
  chartMembers: string[];
  setChartMembers: React.Dispatch<React.SetStateAction<string[]>>;
  chartData: { label: string; values: { [name: string]: number } }[];
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  allPlayerNames,
  chartMembers,
  setChartMembers,
  chartData,
}) => {
  const colors = ['#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6', '#3b82f6'];

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
  const getX = (idx: number) => padding.left + (idx / Math.max(1, chartData.length - 1)) * plotW;
  const zeroY = getY(0);

  return (
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

          {/* 凡例 */}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {chartMembers.map((m, idx) => {
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
  );
};
