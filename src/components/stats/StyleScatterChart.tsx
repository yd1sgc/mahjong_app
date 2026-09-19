'use client';

import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoundStatsRow } from '@/lib/mahjong/statsCalc';

interface StyleScatterChartProps {
  roundStats: RoundStatsRow[];
}

export function StyleScatterChart({ roundStats }: StyleScatterChartProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'riichi_furo' | 'agari_houju' | 'power_speed'>('riichi_furo');
  const [minKyoku, setMinKyoku] = useState<'all' | '100' | '500' | '1000'>('all');
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  const chipsContainerRef = useRef<HTMLDivElement>(null);

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

  // SVG座標マッピング (viewBox: 0 0 480 410)
  // 枠エリア: X 46..446 (幅400), Y 30..360 (高さ330)
  const minX = 10, maxX = 45;
  const minY = 5, maxY = 38;
  const mapX = (furo: number) => 46 + ((furo - minX) / (maxX - minX)) * 400;
  const mapY = (riichi: number) => 360 - ((riichi - minY) / (maxY - minY)) * 330;

  const avgX = Math.max(46, Math.min(446, mapX(avgFuro)));
  const avgY = Math.max(30, Math.min(360, mapY(avgRiichi)));

  // 各プロット点の座標、端の見切れ防止アンカー、および近接ラベル自動分散（衝突回避）
  const placedPoints = useMemo(() => {
    const list = filteredPlayers.map((p) => {
      const cx = Math.max(46, Math.min(446, mapX(p.furoRate)));
      const cy = Math.max(30, Math.min(360, mapY(p.riichiRate)));
      
      let anchor: 'middle' | 'start' | 'end' = 'middle';
      let labelDx = 0;
      if (cx > 425) {
        anchor = 'end';
        labelDx = -5;
      } else if (cx < 75) {
        anchor = 'start';
        labelDx = 5;
      }

      return {
        ...p,
        cx,
        cy,
        labelDx,
        labelDy: -8,
        anchor,
      };
    });

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const dx = list[i].cx - list[j].cx;
        const dy = list[i].cy - list[j].cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 28) {
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

  // タイプ分類
  const getTypeTitle = (riichi: number, furo: number) => {
    if (riichi >= avgRiichi && furo < avgFuro) return '面前リーチ派';
    if (riichi >= avgRiichi && furo >= avgFuro) return '超積極参加派';
    if (riichi < avgRiichi && furo >= avgFuro) return '副露スピード派';
    return '慎重・ダマ派';
  };

  const activeTypeTitle = activePlayer
    ? getTypeTitle(activePlayer.riichiRate, activePlayer.furoRate)
    : '';

  // 打点に応じた色
  const getAgariColor = (avgAgari: number) => {
    if (avgAgari >= 7200) return '#f43f5e'; // 赤
    if (avgAgari >= 6500) return '#f59e0b'; // 黄
    return '#10b981'; // 緑
  };

  // PC対応: マウスホイール横スクロール連動
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && chipsContainerRef.current) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const handleScrollLeft = () => {
    if (chipsContainerRef.current) {
      chipsContainerRef.current.scrollLeft -= 160;
    }
  };

  const handleScrollRight = () => {
    if (chipsContainerRef.current) {
      chipsContainerRef.current.scrollLeft += 160;
    }
  };

  return (
    <section className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xs">
      {/* アコーディオンヘッダー（開閉トグル） */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-850 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-white">雀風スタイル分析</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
            4象限マップ
          </span>
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
          {/* 上部コントロールバー（将来のグラフ追加対応 ＆ 局数フィルター） */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800/80">
            {/* グラフ種類タブ */}
            <div className="flex gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 self-start">
              <button
                type="button"
                onClick={() => setChartType('riichi_furo')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartType === 'riichi_furo'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                立直 × 副露
              </button>
              <button
                type="button"
                disabled
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-600 cursor-not-allowed"
                title="将来追加予定"
              >
                和了 × 放銃
              </button>
              <button
                type="button"
                disabled
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-600 cursor-not-allowed"
                title="将来追加予定"
              >
                打点 × 速度
              </button>
            </div>

            {/* 局数フィルター（全員デフォルト / 100+ / 500+ / 1000+） */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[10px] text-neutral-400 font-bold">局数:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMinKyoku('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    minKyoku === 'all'
                      ? 'bg-amber-500 text-neutral-950 font-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  全員
                </button>
                <button
                  type="button"
                  onClick={() => setMinKyoku('100')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    minKyoku === '100'
                      ? 'bg-amber-500 text-neutral-950 font-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  100+
                </button>
                <button
                  type="button"
                  onClick={() => setMinKyoku('500')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    minKyoku === '500'
                      ? 'bg-amber-500 text-neutral-950 font-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  500+
                </button>
                <button
                  type="button"
                  onClick={() => setMinKyoku('1000')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    minKyoku === '1000'
                      ? 'bg-amber-500 text-neutral-950 font-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  1000+
                </button>
              </div>
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500 font-bold">
              該当する局データがありません
            </div>
          ) : (
            <>
              {/* 散布図SVGエリア */}
              <div className="flex justify-center bg-neutral-950 rounded-xl p-2.5 border border-neutral-800">
                <svg
                  viewBox="0 0 480 410"
                  className="w-full max-w-[460px] h-auto select-none overflow-visible"
                >
                  {/* 象限背景 */}
                  <rect
                    x="46"
                    y="30"
                    width={Math.max(0, avgX - 46)}
                    height={Math.max(0, avgY - 30)}
                    fill="#3b82f6"
                    fillOpacity="0.04"
                  />
                  <rect
                    x={avgX}
                    y="30"
                    width={Math.max(0, 446 - avgX)}
                    height={Math.max(0, avgY - 30)}
                    fill="#ef4444"
                    fillOpacity="0.04"
                  />
                  <rect
                    x="46"
                    y={avgY}
                    width={Math.max(0, avgX - 46)}
                    height={Math.max(0, 360 - avgY)}
                    fill="#8b5cf6"
                    fillOpacity="0.04"
                  />
                  <rect
                    x={avgX}
                    y={avgY}
                    width={Math.max(0, 446 - avgX)}
                    height={Math.max(0, 360 - avgY)}
                    fill="#10b981"
                    fillOpacity="0.04"
                  />

                  {/* 外枠 */}
                  <rect
                    x="46"
                    y="30"
                    width="400"
                    height="330"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="1.5"
                  />

                  {/* 十字平均線 */}
                  <line
                    x1="46"
                    y1={avgY}
                    x2="446"
                    y2={avgY}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />
                  <line
                    x1={avgX}
                    y1="30"
                    x2={avgX}
                    y2="360"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />

                  {/* 象限名 */}
                  <text
                    x={(46 + avgX) / 2}
                    y="48"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#60a5fa"
                    opacity="0.85"
                  >
                    面前リーチ
                  </text>
                  <text
                    x={(avgX + 446) / 2}
                    y="48"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#f87171"
                    opacity="0.85"
                  >
                    超積極
                  </text>
                  <text
                    x={(46 + avgX) / 2}
                    y="350"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#a78bfa"
                    opacity="0.85"
                  >
                    慎重ダマ
                  </text>
                  <text
                    x={(avgX + 446) / 2}
                    y="350"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#34d399"
                    opacity="0.85"
                  >
                    副露スピード
                  </text>

                  {/* 軸タイトル（目盛と物理的重なりゼロの独立配置） */}
                  <text
                    x="46"
                    y="18"
                    textAnchor="start"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#a3a3a3"
                  >
                    立直率 (%)
                  </text>
                  <text
                    x="446"
                    y="398"
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#a3a3a3"
                  >
                    副露率 (%)
                  </text>

                  {/* X軸目盛（y=376: タイトル y=398 と22px分離） */}
                  <text
                    x="46"
                    y="376"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    10%
                  </text>
                  <text
                    x={avgX}
                    y="376"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#38bdf8"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {avgFuro}%
                  </text>
                  <text
                    x="446"
                    y="376"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    45%
                  </text>

                  {/* Y軸目盛（x=38: 枠線から8px離し、左端余白8px確保で見切れゼロ） */}
                  <text
                    x="38"
                    y="363"
                    textAnchor="end"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    5%
                  </text>
                  <text
                    x="38"
                    y={avgY + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#38bdf8"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {avgRiichi}%
                  </text>
                  <text
                    x="38"
                    y="35"
                    textAnchor="end"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    38%
                  </text>

                  {/* プロット点（小型ドット・黒フチ輪郭） */}
                  {placedPoints.map((p) => {
                    const isSel = activePlayer?.name === p.name;
                    const color = getAgariColor(p.avgAgari);
                    const textX = p.cx + p.labelDx;
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
                          x={textX}
                          y={textY}
                          textAnchor={p.anchor}
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

              {/* 凡例（「平均打点」を明確に記載） */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 border-b border-neutral-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-300 font-bold">平均打点:</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    7,200点+
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
                <span className="text-[10px] text-neutral-500 font-mono">
                  対象: <span className="text-white font-bold">{filteredPlayers.length}</span>名
                </span>
              </div>

              {/* プレイヤー選択チップ一覧（横スクロール保持 ＋ PCホイール＆左右矢印対応） */}
              <div className="relative flex items-center group">
                <button
                  type="button"
                  onClick={handleScrollLeft}
                  className="hidden sm:flex absolute left-0 z-10 w-6 h-7 bg-neutral-800/90 hover:bg-neutral-700 text-white rounded-r items-center justify-center shadow-md cursor-pointer"
                  aria-label="左へスクロール"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                  ref={chipsContainerRef}
                  onWheel={handleWheel}
                  className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none sm:px-2 scroll-smooth"
                >
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

                <button
                  type="button"
                  onClick={handleScrollRight}
                  className="hidden sm:flex absolute right-0 z-10 w-6 h-7 bg-neutral-800/90 hover:bg-neutral-700 text-white rounded-l items-center justify-center shadow-md cursor-pointer"
                  aria-label="右へスクロール"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 選択プレイヤー詳細カード（無駄なポエム全廃・数字とタイプのみ） */}
              {activePlayer && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">
                        {activePlayer.name}
                      </h3>
                      <span className="text-xs font-bold text-amber-400">
                        {activeTypeTitle}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      {activePlayer.kyokuCount}局
                    </span>
                  </div>

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
                      <span
                        className="text-sm font-bold font-mono"
                        style={{ color: getAgariColor(activePlayer.avgAgari) }}
                      >
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
