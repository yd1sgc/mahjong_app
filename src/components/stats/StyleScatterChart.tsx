'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { RoundStatsRow } from '@/lib/mahjong/statsCalc';

interface StyleScatterChartProps {
  roundStats: RoundStatsRow[];
}

export function StyleScatterChart({ roundStats }: StyleScatterChartProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [minKyoku, setMinKyoku] = useState<'10' | '20' | 'all'>('10');
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  // 局数フィルター適用
  const filteredPlayers = useMemo(() => {
    if (minKyoku === 'all') return roundStats;
    const min = parseInt(minKyoku, 10);
    return roundStats.filter((p) => p.kyokuCount >= min);
  }, [roundStats, minKyoku]);

  // 選択プレイヤー（未選択またはフィルターで除外された場合は先頭）
  const activePlayer = useMemo(() => {
    if (filteredPlayers.length === 0) return null;
    const found = filteredPlayers.find((p) => p.name === selectedPlayerName);
    return found || filteredPlayers[0];
  }, [filteredPlayers, selectedPlayerName]);

  // 全体平均値
  const { avgRiichi, avgFuro } = useMemo(() => {
    if (filteredPlayers.length === 0) return { avgRiichi: 0, avgFuro: 0 };
    const rSum = filteredPlayers.reduce((acc, p) => acc + p.riichiRate, 0);
    const fSum = filteredPlayers.reduce((acc, p) => acc + p.furoRate, 0);
    return {
      avgRiichi: Math.round((rSum / filteredPlayers.length) * 10) / 10,
      avgFuro: Math.round((fSum / filteredPlayers.length) * 10) / 10,
    };
  }, [filteredPlayers]);

  // SVG座標マッピング (viewBox: 0 0 500 480)
  // 有効エリア: X 55..465, Y 45..425
  const minX = 10, maxX = 45;
  const minY = 5, maxY = 36;
  const mapX = (furo: number) => 55 + ((furo - minX) / (maxX - minX)) * 410;
  const mapY = (riichi: number) => 425 - ((riichi - minY) / (maxY - minY)) * 380;

  const avgX = Math.max(55, Math.min(465, mapX(avgFuro)));
  const avgY = Math.max(45, Math.min(425, mapY(avgRiichi)));

  // 各プロット点の座標および近接ラベル自動分散（衝突回避）
  const placedPoints = useMemo(() => {
    const list = filteredPlayers.map((p) => {
      const cx = Math.max(55, Math.min(465, mapX(p.furoRate)));
      const cy = Math.max(45, Math.min(425, mapY(p.riichiRate)));
      return {
        ...p,
        cx,
        cy,
        labelDy: -8,
      };
    });

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const dx = list[i].cx - list[j].cx;
        const dy = list[i].cy - list[j].cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 32) {
          if (list[i].cy <= list[j].cy) {
            list[i].labelDy = -9;
            list[j].labelDy = 13;
          } else {
            list[i].labelDy = 13;
            list[j].labelDy = -9;
          }
        }
      }
    }

    return list;
  }, [filteredPlayers]);

  // タイプ解説の判定
  const getTypeInfo = (riichi: number, furo: number) => {
    if (riichi >= avgRiichi && furo < avgFuro) {
      return {
        title: '面前リーチ派（王道門前）',
        desc: '鳴きを抑え、手牌を育ててリーチで真っ向勝負を挑む王道スタイル。',
      };
    }
    if (riichi >= avgRiichi && furo >= avgFuro) {
      return {
        title: '超積極参加派（両刀攻め）',
        desc: '面前リーチも鳴きも両方積極的に使い、局の主導権を常に握りに行くスタイル。',
      };
    }
    if (riichi < avgRiichi && furo >= avgFuro) {
      return {
        title: '副露スピード派（手数重視）',
        desc: '鳴き主体で手牌を素早く短くし、アガリの速さと手数で圧倒するスタイル。',
      };
    }
    return {
      title: '慎重・ダマ派（潜伏堅実）',
      desc: '鳴きもリーチも厳選し、安全牌を意識しながらダマテンやオリを的確に使い分ける堅実派。',
    };
  };

  const activeType = activePlayer
    ? getTypeInfo(activePlayer.riichiRate, activePlayer.furoRate)
    : null;

  return (
    <section className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xs">
      {/* アコーディオンヘッダー（開閉トグル） */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-850 transition-colors cursor-pointer"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-white">雀風スタイル分析</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              立直率 × 副露率
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            仕掛けと面前の傾向からプレイスタイルを4象限に可視化
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400 font-mono">
            {isOpen ? '閉じる' : '開く'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* アコーディオン開時のみ描画（オンデマンド） */}
      {isOpen && (
        <div className="border-t border-neutral-800 p-4 flex flex-col gap-3">
          {/* 最低局数フィルター */}
          <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800/60">
            <span className="text-neutral-400 font-bold text-[11px]">表示対象:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMinKyoku('10')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  minKyoku === '10'
                    ? 'bg-amber-500 text-neutral-950 font-black'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                10局以上
              </button>
              <button
                type="button"
                onClick={() => setMinKyoku('20')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  minKyoku === '20'
                    ? 'bg-amber-500 text-neutral-950 font-black'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                20局以上
              </button>
              <button
                type="button"
                onClick={() => setMinKyoku('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  minKyoku === 'all'
                    ? 'bg-amber-500 text-neutral-950 font-black'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                全員表示
              </button>
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500 font-bold">
              該当する局データがありません
            </div>
          ) : (
            <>
              {/* 散布図SVGエリア */}
              <div className="flex justify-center bg-neutral-950 rounded-xl p-2 border border-neutral-800/80">
                <svg
                  viewBox="0 0 500 480"
                  className="w-full max-w-[440px] h-auto select-none"
                >
                  {/* 象限背景 */}
                  <rect
                    x="55"
                    y="45"
                    width={Math.max(0, avgX - 55)}
                    height={Math.max(0, avgY - 45)}
                    fill="#3b82f6"
                    fillOpacity="0.04"
                  />
                  <rect
                    x={avgX}
                    y="45"
                    width={Math.max(0, 465 - avgX)}
                    height={Math.max(0, avgY - 45)}
                    fill="#ef4444"
                    fillOpacity="0.04"
                  />
                  <rect
                    x="55"
                    y={avgY}
                    width={Math.max(0, avgX - 55)}
                    height={Math.max(0, 425 - avgY)}
                    fill="#8b5cf6"
                    fillOpacity="0.04"
                  />
                  <rect
                    x={avgX}
                    y={avgY}
                    width={Math.max(0, 465 - avgX)}
                    height={Math.max(0, 425 - avgY)}
                    fill="#10b981"
                    fillOpacity="0.04"
                  />

                  {/* 枠線 */}
                  <rect
                    x="55"
                    y="45"
                    width="410"
                    height="380"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="1.5"
                  />

                  {/* 十字平均線 */}
                  <line
                    x1="55"
                    y1={avgY}
                    x2="465"
                    y2={avgY}
                    stroke="#404040"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={avgX}
                    y1="45"
                    x2={avgX}
                    y2="425"
                    stroke="#404040"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* 象限見出し */}
                  <text
                    x={(55 + avgX) / 2}
                    y="65"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#60a5fa"
                    opacity="0.9"
                  >
                    面前リーチ派
                  </text>
                  <text
                    x={(avgX + 465) / 2}
                    y="65"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#f87171"
                    opacity="0.9"
                  >
                    超積極参加派
                  </text>
                  <text
                    x={(55 + avgX) / 2}
                    y="415"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#a78bfa"
                    opacity="0.9"
                  >
                    慎重・ダマ派
                  </text>
                  <text
                    x={(avgX + 465) / 2}
                    y="415"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#34d399"
                    opacity="0.9"
                  >
                    副露スピード派
                  </text>

                  {/* 軸タイトル（重なり完全回避の枠外配置） */}
                  <text
                    x="55"
                    y="32"
                    textAnchor="start"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#38bdf8"
                  >
                    ↑ 立直率（%）
                  </text>
                  <text
                    x="465"
                    y="445"
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#38bdf8"
                  >
                    副露率（%） →
                  </text>

                  {/* X軸目盛 */}
                  <text
                    x="55"
                    y="445"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    10%
                  </text>
                  <text
                    x={avgX}
                    y="445"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#38bdf8"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    平均{avgFuro}%
                  </text>
                  <text
                    x="350"
                    y="445"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    35%
                  </text>

                  {/* Y軸目盛 */}
                  <text
                    x="48"
                    y="428"
                    textAnchor="end"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    5%
                  </text>
                  <text
                    x="48"
                    y={avgY + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#38bdf8"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    平均{avgRiichi}%
                  </text>
                  <text
                    x="48"
                    y="48"
                    textAnchor="end"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    35%
                  </text>

                  {/* プロット点（小型ドット・黒フチ文字） */}
                  {placedPoints.map((p) => {
                    const isSel = activePlayer?.name === p.name;
                    let color = '#38bdf8';
                    if (p.avgAgari >= 7200) color = '#f43f5e';
                    else if (p.avgAgari >= 6500) color = '#f59e0b';
                    else color = '#10b981';

                    const textY = isSel ? p.cy - 10 : p.cy + p.labelDy;

                    return (
                      <g
                        key={p.name}
                        onClick={() => setSelectedPlayerName(p.name)}
                        className="cursor-pointer"
                      >
                        {isSel && (
                          <circle
                            cx={p.cx}
                            cy={p.cy}
                            r={9.5}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth={2}
                          />
                        )}
                        <circle
                          cx={p.cx}
                          cy={p.cy}
                          r={isSel ? 5.5 : 4.2}
                          fill={color}
                          stroke={isSel ? '#ffffff' : '#0a0a0a'}
                          strokeWidth={isSel ? 2 : 1.2}
                        />
                        <text
                          x={p.cx}
                          y={textY}
                          textAnchor="middle"
                          fontSize={isSel ? '11' : '9.5'}
                          fontWeight={isSel ? 'bold' : '600'}
                          fill={isSel ? '#fbbf24' : '#f5f5f5'}
                          stroke="#000000"
                          strokeWidth={3}
                          strokeLinejoin="round"
                          style={{ paintOrder: 'stroke fill' }}
                        >
                          {p.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 凡例 */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    打点7,200以上
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    6,500〜7,199
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    6,500未満
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500">※円サイズ固定</span>
              </div>

              {/* プレイヤー選択チップ一覧 */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                {filteredPlayers.map((p) => {
                  const isSel = activePlayer?.name === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setSelectedPlayerName(p.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-500 text-neutral-950 font-black shadow-xs'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>

              {/* 選択プレイヤー詳細カード */}
              {activePlayer && activeType && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">
                        {activePlayer.name}
                      </h3>
                      <span className="text-xs font-bold text-amber-400">
                        {activeType.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      {activePlayer.kyokuCount}局
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mb-2.5 leading-relaxed">
                    {activeType.desc}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        立直率
                      </span>
                      <span className="text-sm font-bold font-mono text-white">
                        {activePlayer.riichiRate}%
                      </span>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        副露率
                      </span>
                      <span className="text-sm font-bold font-mono text-white">
                        {activePlayer.furoRate}%
                      </span>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        平均和了打点
                      </span>
                      <span className="text-sm font-bold font-mono text-amber-400">
                        {activePlayer.avgAgari.toLocaleString()}点
                      </span>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        ダマ和了率
                      </span>
                      <span className="text-sm font-bold font-mono text-white">
                        {activePlayer.damaAgariRate}%
                      </span>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        和了率
                      </span>
                      <span className="text-sm font-bold font-mono text-white">
                        {activePlayer.agariRate}%
                      </span>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        放銃率
                      </span>
                      <span className="text-sm font-bold font-mono text-white">
                        {activePlayer.houjuRate}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
