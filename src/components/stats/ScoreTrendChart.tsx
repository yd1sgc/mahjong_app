'use client';

import React, { useMemo } from 'react';

interface ScoreTrendChartProps {
  allPlayerNames: string[];
  chartMembers: string[];
  setChartMembers: React.Dispatch<React.SetStateAction<string[]>>;
  chartData: { label: string; values: { [name: string]: number } }[];
}

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  allPlayerNames,
  chartMembers,
  setChartMembers,
  chartData,
}) => {
  // 選択中メンバーごとの固定カラー割り当て
  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>();
    chartMembers.forEach((name, idx) => {
      map.set(name, COLORS[idx % COLORS.length]);
    });
    return map;
  }, [chartMembers]);

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

  // 上下に適度な余白を持たせる
  const yMin = Math.min(minPt - 15, -30);
  const yMax = Math.max(maxPt + 15, 30);
  const range = Math.max(1, yMax - yMin);

  const width = Math.max(340, chartData.length * 36);
  const height = 200;
  const padding = { top: 20, bottom: 28, left: 45, right: 30 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const getY = (val: number) => padding.top + plotH - ((val - yMin) / range) * plotH;
  const getX = (idx: number) => padding.left + (idx / Math.max(1, chartData.length - 1)) * plotW;
  const zeroY = getY(0);

  // X軸の表示対象インデックス選定（重なり防止）
  const visibleXIndices = useMemo(() => {
    const len = chartData.length;
    if (len <= 1) return [];
    if (len <= 10) return Array.from({ length: len }, (_, i) => i);
    const step = len > 25 ? 5 : len > 15 ? 3 : 2;
    const indices = new Set<number>();
    indices.add(0); // 開始
    for (let i = step; i < len - 1; i += step) {
      indices.add(i);
    }
    indices.add(len - 1); // 最終試合
    return Array.from(indices).sort((a, b) => a - b);
  }, [chartData.length]);

  return (
    <section className="flex flex-col gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xs">
      <h2 className="text-base font-black text-white">総合ポイント推移</h2>

      {/* プレイヤー選択チップ（名前のみ・担当カラー連動） */}
      <div>
        <span className="text-[11px] font-black text-neutral-400 block mb-1.5">
          表示メンバー（クリックで表示切替）
        </span>
        <div className="flex flex-wrap gap-1.5">
          {allPlayerNames.map((name) => {
            const activeColor = memberColorMap.get(name);
            const isSelected = !!activeColor;

            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setChartMembers((prev) =>
                    prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
                  );
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  isSelected
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-950/60 border border-neutral-800 text-neutral-500 hover:text-neutral-300'
                }`}
                style={isSelected ? { borderColor: activeColor, borderWidth: '1px' } : undefined}
              >
                {isSelected && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeColor }}
                  />
                )}
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG折れ線グラフ */}
      {chartMembers.length === 0 || chartData.length <= 1 ? (
        <div className="h-44 flex items-center justify-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
          表示対象のメンバーを選択してください。
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg width={width} height={height} className="bg-neutral-950 rounded-xl border border-neutral-800 block">
            {/* 上下限補助線 */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={width - padding.right}
              y2={padding.top}
              stroke="#262626"
              strokeWidth="1"
            />
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="#262626"
              strokeWidth="1"
            />

            {/* 縦目盛グリッド線 */}
            {visibleXIndices.map((idx) => {
              if (idx === 0) return null;
              return (
                <line
                  key={idx}
                  x1={getX(idx)}
                  y1={padding.top}
                  x2={getX(idx)}
                  y2={height - padding.bottom}
                  stroke="#262626"
                  strokeDasharray="2 2"
                />
              );
            })}

            {/* 0pt 基準線 */}
            {yMin <= 0 && yMax >= 0 && (
              <line
                x1={padding.left}
                y1={zeroY}
                x2={width - padding.right}
                y2={zeroY}
                stroke="#525252"
                strokeDasharray="4 3"
                strokeWidth="1.2"
              />
            )}

            {/* Y軸ラベル */}
            <text
              x={padding.left - 6}
              y={getY(maxPt) + 3}
              textAnchor="end"
              fill="#737373"
              fontSize="9"
              fontFamily="monospace"
            >
              {maxPt > 0 ? `+${maxPt.toFixed(0)}` : maxPt.toFixed(0)}
            </text>
            <text
              x={padding.left - 6}
              y={zeroY + 3}
              textAnchor="end"
              fill="#d4d4d4"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
            >
              0
            </text>
            <text
              x={padding.left - 6}
              y={getY(minPt) + 3}
              textAnchor="end"
              fill="#737373"
              fontSize="9"
              fontFamily="monospace"
            >
              {minPt.toFixed(0)}
            </text>

            {/* X軸ラベル */}
            {visibleXIndices.map((idx) => {
              const d = chartData[idx];
              if (!d) return null;
              return (
                <text
                  key={idx}
                  x={getX(idx)}
                  y={height - 8}
                  textAnchor="middle"
                  fill="#737373"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {d.label}
                </text>
              );
            })}

            {/* 各プレイヤーの折れ線 */}
            {chartMembers.map((m) => {
              const color = memberColorMap.get(m) || '#ffffff';
              const pts = chartData
                .map((d, idx) => `${getX(idx)},${getY(d.values[m] || 0)}`)
                .join(' ');

              const lastScore = chartData[chartData.length - 1]?.values[m] || 0;
              const lastX = getX(chartData.length - 1);
              const lastY = getY(lastScore);

              return (
                <g key={m}>
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pts}
                  />
                  {/* 各ポイントのドット */}
                  {chartData.map((d, idx) => (
                    <circle
                      key={idx}
                      cx={getX(idx)}
                      cy={getY(d.values[m] || 0)}
                      r="1.5"
                      fill={color}
                    />
                  ))}
                  {/* 最終試合の円 */}
                  <circle
                    cx={lastX}
                    cy={lastY}
                    r="3.5"
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
};
