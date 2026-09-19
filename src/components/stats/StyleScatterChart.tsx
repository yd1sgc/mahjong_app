'use client';

import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoundStatsRow } from '@/lib/mahjong/statsCalc';
import { calculatePcaStyles, PcaResult } from '@/lib/mahjong/pcaCalc';

interface StyleScatterChartProps {
  roundStats: RoundStatsRow[];
}

type ChartType = 'riichi_furo' | 'agari_houju' | 'pca';

export function StyleScatterChart({ roundStats }: StyleScatterChartProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<ChartType>('riichi_furo');
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

  // PCA主成分分析の計算
  const pcaResult: PcaResult | null = useMemo(() => {
    if (chartType !== 'pca' || filteredPlayers.length < 3) return null;
    return calculatePcaStyles(filteredPlayers);
  }, [chartType, filteredPlayers]);

  // 各種平均値
  const averages = useMemo(() => {
    if (filteredPlayers.length === 0) {
      return { avgRiichi: 0, avgFuro: 0, avgAgariRate: 0, avgHoujuRate: 0 };
    }
    const n = filteredPlayers.length;
    const rSum = filteredPlayers.reduce((acc, p) => acc + p.riichiRate, 0);
    const fSum = filteredPlayers.reduce((acc, p) => acc + p.furoRate, 0);
    const aSum = filteredPlayers.reduce((acc, p) => acc + p.agariRate, 0);
    const hSum = filteredPlayers.reduce((acc, p) => acc + p.houjuRate, 0);
    return {
      avgRiichi: Math.round((rSum / n) * 10) / 10,
      avgFuro: Math.round((fSum / n) * 10) / 10,
      avgAgariRate: Math.round((aSum / n) * 10) / 10,
      avgHoujuRate: Math.round((hSum / n) * 10) / 10,
    };
  }, [filteredPlayers]);

  // SVG座標マッピング設定 (viewBox: 0 0 480 410)
  // 枠エリア: X 46..446 (幅400), Y 30..360 (高さ330)
  const chartConfig = useMemo(() => {
    if (chartType === 'agari_houju') {
      const minX = 6;
      const maxX = 20;
      const minY = 12;
      const maxY = 32;
      const mapX = (houju: number) => 46 + ((houju - minX) / (maxX - minX)) * 400;
      const mapY = (agari: number) => 360 - ((agari - minY) / (maxY - minY)) * 330;
      const avgX = Math.max(46, Math.min(446, mapX(averages.avgHoujuRate)));
      const avgY = Math.max(30, Math.min(360, mapY(averages.avgAgariRate)));
      return {
        minX,
        maxX,
        minY,
        maxY,
        mapX,
        mapY,
        avgX,
        avgY,
        xTitle: '放銃率 (%)',
        yTitle: '和了率 (%)',
        xMinLabel: '6%',
        xAvgLabel: `${averages.avgHoujuRate}%`,
        xMaxLabel: '20%',
        yMinLabel: '12%',
        yAvgLabel: `${averages.avgAgariRate}%`,
        yMaxLabel: '32%',
        qTopLeft: '鉄壁好調',
        qTopRight: '超乱打戦',
        qBottomLeft: '慎重守備',
        qBottomRight: '苦戦被弾',
      };
    }

    if (chartType === 'pca') {
      const maxScore = pcaResult ? Math.max(pcaResult.maxAbsScore, 2.5) : 3.0;
      const minX = -maxScore;
      const maxX = maxScore;
      const minY = -maxScore;
      const maxY = maxScore;
      const mapX = (score1: number) => 46 + ((score1 - minX) / (maxX - minX)) * 400;
      const mapY = (score2: number) => 360 - ((score2 - minY) / (maxY - minY)) * 330;
      const avgX = 246; // 原点 0
      const avgY = 195; // 原点 0
      return {
        minX,
        maxX,
        minY,
        maxY,
        mapX,
        mapY,
        avgX,
        avgY,
        xTitle: `PC1: 手役・仕掛け (${pcaResult ? pcaResult.pc1Ratio : 0}%)`,
        yTitle: `PC2: 参加・粘り (${pcaResult ? pcaResult.pc2Ratio : 0}%)`,
        xMinLabel: `-${maxScore}`,
        xAvgLabel: '0',
        xMaxLabel: `+${maxScore}`,
        yMinLabel: `-${maxScore}`,
        yAvgLabel: '0',
        yMaxLabel: `+${maxScore}`,
        qTopLeft: '速攻手筋',
        qTopRight: '面前重厚',
        qBottomLeft: '守備オリ',
        qBottomRight: '慎重ダマ',
      };
    }

    // デフォルト: riichi_furo
    const minX = 10;
    const maxX = 45;
    const minY = 5;
    const maxY = 38;
    const mapX = (furo: number) => 46 + ((furo - minX) / (maxX - minX)) * 400;
    const mapY = (riichi: number) => 360 - ((riichi - minY) / (maxY - minY)) * 330;
    const avgX = Math.max(46, Math.min(446, mapX(averages.avgFuro)));
    const avgY = Math.max(30, Math.min(360, mapY(averages.avgRiichi)));
    return {
      minX,
      maxX,
      minY,
      maxY,
      mapX,
      mapY,
      avgX,
      avgY,
      xTitle: '副露率 (%)',
      yTitle: '立直率 (%)',
      xMinLabel: '10%',
      xAvgLabel: `${averages.avgFuro}%`,
      xMaxLabel: '45%',
      yMinLabel: '5%',
      yAvgLabel: `${averages.avgRiichi}%`,
      yMaxLabel: '38%',
      qTopLeft: '面前リーチ',
      qTopRight: '超積極',
      qBottomLeft: '慎重ダマ',
      qBottomRight: '副露スピード',
    };
  }, [chartType, averages, pcaResult]);

  // 各プロット点の座標・衝突回避・ラベル位置計算
  const placedPoints = useMemo(() => {
    if (chartType === 'pca') {
      if (!pcaResult) return [];
      const list = pcaResult.players.map((p) => {
        const rawCx = chartConfig.mapX(p.pc1);
        const rawCy = chartConfig.mapY(p.pc2);
        const cx = Math.max(52, Math.min(440, rawCx));
        const cy = Math.max(38, Math.min(352, rawCy));

        let anchor: 'middle' | 'start' | 'end' = 'middle';
        let labelDx = 0;
        if (cx > 415) {
          anchor = 'end';
          labelDx = -6;
        } else if (cx < 78) {
          anchor = 'start';
          labelDx = 6;
        }

        // 基本オフセット: 点の上部
        const labelDy = cy < 50 ? 15 : -10;

        return {
          ...p.stats,
          pc1: p.pc1,
          pc2: p.pc2,
          cx,
          cy,
          labelDx,
          labelDy,
          anchor,
        };
      });

      // 衝突回避
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const dx = list[i].cx - list[j].cx;
          const dy = list[i].cy - list[j].cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 26) {
            if (list[i].cy <= list[j].cy) {
              list[i].labelDy = -10;
              list[j].labelDy = 15;
            } else {
              list[i].labelDy = 15;
              list[j].labelDy = -10;
            }
          }
        }
      }
      return list;
    }

    // riichi_furo または agari_houju
    const list = filteredPlayers.map((p) => {
      const rawX = chartType === 'agari_houju' ? p.houjuRate : p.furoRate;
      const rawY = chartType === 'agari_houju' ? p.agariRate : p.riichiRate;
      const rawCx = chartConfig.mapX(rawX);
      const rawCy = chartConfig.mapY(rawY);
      const cx = Math.max(52, Math.min(440, rawCx));
      const cy = Math.max(38, Math.min(352, rawCy));

      let anchor: 'middle' | 'start' | 'end' = 'middle';
      let labelDx = 0;
      if (cx > 415) {
        anchor = 'end';
        labelDx = -6;
      } else if (cx < 78) {
        anchor = 'start';
        labelDx = 6;
      }

      // 基本オフセット: 点の上部 (上端付近なら下部)
      const labelDy = cy < 50 ? 15 : -10;

      return {
        ...p,
        cx,
        cy,
        labelDx,
        labelDy,
        anchor,
      };
    });

    // 衝突回避
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const dx = list[i].cx - list[j].cx;
        const dy = list[i].cy - list[j].cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 26) {
          if (list[i].cy <= list[j].cy) {
            list[i].labelDy = -10;
            list[j].labelDy = 15;
          } else {
            list[i].labelDy = 15;
            list[j].labelDy = -10;
          }
        }
      }
    }

    return list;
  }, [chartType, filteredPlayers, chartConfig, pcaResult]);

  // タイプ分類
  const getPlayerTypeTitle = (player: RoundStatsRow) => {
    if (chartType === 'agari_houju') {
      const isHighAgari = player.agariRate >= averages.avgAgariRate;
      const isLowHouju = player.houjuRate < averages.avgHoujuRate;
      if (isHighAgari && isLowHouju) return '鉄壁好調型';
      if (isHighAgari && !isLowHouju) return '超乱打戦型';
      if (!isHighAgari && isLowHouju) return '慎重守備型';
      return '苦戦被弾型';
    }

    if (chartType === 'pca') {
      const pScore = pcaResult?.players.find((item) => item.name === player.name);
      if (!pScore) return '';
      if (pScore.pc1 >= 0 && pScore.pc2 >= 0) return '重厚面前攻撃型';
      if (pScore.pc1 < 0 && pScore.pc2 >= 0) return '速攻手筋参加型';
      if (pScore.pc1 >= 0 && pScore.pc2 < 0) return '面前ダマ慎重型';
      return '守備オリ重視型';
    }

    // riichi_furo
    if (player.riichiRate >= averages.avgRiichi && player.furoRate < averages.avgFuro) {
      return '面前リーチ派';
    }
    if (player.riichiRate >= averages.avgRiichi && player.furoRate >= averages.avgFuro) {
      return '超積極参加派';
    }
    if (player.riichiRate < averages.avgRiichi && player.furoRate >= averages.avgFuro) {
      return '副露スピード派';
    }
    return '慎重・ダマ派';
  };

  const activeTypeTitle = activePlayer ? getPlayerTypeTitle(activePlayer) : '';

  // スタイル説明文
  const getPlayerTypeDescription = (player: RoundStatsRow) => {
    if (chartType === 'agari_houju') {
      const isHighAgari = player.agariRate >= averages.avgAgariRate;
      const isLowHouju = player.houjuRate < averages.avgHoujuRate;
      if (isHighAgari && isLowHouju) return '高いアガリ率と低い放銃率を両立する理想的な好成績スタイル';
      if (isHighAgari && !isLowHouju) return '高いアガリ率を誇る一方、失点も恐れず踏み込むインファイト型';
      if (!isHighAgari && isLowHouju) return '徹底した失点回避を貫き、守備力で着順をまとめる受けのスタイル';
      return '放銃が先行しアガリに結びついていない、我慢の展開が続く状態';
    }

    if (chartType === 'pca') {
      const pScore = pcaResult?.players.find((item) => item.name === player.name);
      if (!pScore) return '';
      if (pScore.pc1 >= 0 && pScore.pc2 >= 0) return '高い打点力と積極的な局参加を両立する重厚なアグレッシブ派';
      if (pScore.pc1 < 0 && pScore.pc2 >= 0) return 'スピード仕掛けと手筋を駆使し、手数を稼ぐ実戦的速攻派';
      if (pScore.pc1 >= 0 && pScore.pc2 < 0) return '面前の手役力を備えつつ、無理な参加を避ける冷静沈着派';
      return 'リスクを徹底排除し、受けと失点回避に重きを置く守備特化派';
    }

    // riichi_furo
    if (player.riichiRate >= averages.avgRiichi && player.furoRate < averages.avgFuro) {
      return '面前で手役を作り、高打点を狙う重厚な攻めが持ち味';
    }
    if (player.riichiRate >= averages.avgRiichi && player.furoRate >= averages.avgFuro) {
      return '立直と副露を自在に使い分け、積極的にアガリに向かう超攻撃型';
    }
    if (player.riichiRate < averages.avgRiichi && player.furoRate >= averages.avgFuro) {
      return '仕掛けを多用し、打点よりも速度で局を支配するスピード型';
    }
    return 'リーチや副露を抑え、ダマテンや守備を重視する堅実型';
  };

  const activeTypeDescription = activePlayer ? getPlayerTypeDescription(activePlayer) : '';

  // 打点の動的閾値（母集団の3分位: 上位1/3・下位1/3）
  const { highThreshold, lowThreshold } = useMemo(() => {
    if (filteredPlayers.length < 3) {
      return { highThreshold: 7200, lowThreshold: 6500 };
    }
    const scores = filteredPlayers
      .map((p) => p.avgAgari)
      .filter((s) => s > 0)
      .sort((a, b) => b - a);

    if (scores.length < 3) {
      return { highThreshold: 7200, lowThreshold: 6500 };
    }

    const n = scores.length;
    const highIdx = Math.floor(n / 3);
    const lowIdx = Math.floor((n * 2) / 3);

    let high = Math.round(scores[highIdx] / 100) * 100;
    let low = Math.round(scores[lowIdx] / 100) * 100;

    if (high <= low) {
      high = low + 100;
    }

    return { highThreshold: high, lowThreshold: low };
  }, [filteredPlayers]);

  // 打点に応じた動的色判定（母集団の上位1/3が赤、中位1/3が黄、下位1/3が緑）
  const getAgariColor = (avgAgari: number) => {
    if (avgAgari >= highThreshold) return '#f43f5e'; // 赤: 上位1/3 (高打点)
    if (avgAgari >= lowThreshold) return '#f59e0b';  // 黄: 中位1/3 (標準)
    return '#10b981';                              // 緑: 下位1/3 (安手)
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

  // 選択プレイヤーを最前面にするためソート（非選択を先に、選択を最後に描画）
  const sortedRenderPoints = useMemo(() => {
    return [...placedPoints].sort((a, b) => {
      const aSel = activePlayer?.name === a.name ? 1 : 0;
      const bSel = activePlayer?.name === b.name ? 1 : 0;
      return aSel - bSel;
    });
  }, [placedPoints, activePlayer]);

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
          {/* 上部コントロールバー（3チャート切り替え ＆ 局数フィルター） */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800/80">
            {/* グラフ種類タブ */}
            <div className="flex gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 self-start">
              <button
                type="button"
                onClick={() => setChartType('riichi_furo')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'riichi_furo'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                立直 × 副露
              </button>
              <button
                type="button"
                onClick={() => setChartType('agari_houju')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'agari_houju'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                和了 × 放銃
              </button>
              <button
                type="button"
                onClick={() => setChartType('pca')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'pca'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                主成分分析
              </button>
            </div>

            {/* 局数フィルター（全員デフォルト / 100+ / 500+ / 1000+） */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[10px] text-neutral-400 font-bold">局数:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMinKyoku('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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

          {filteredPlayers.length === 0 || (chartType === 'pca' && !pcaResult) ? (
            <div className="py-12 text-center text-xs text-neutral-500 font-bold">
              {chartType === 'pca'
                ? '主成分分析には最低3名以上の局データが必要です'
                : '該当する局データがありません'}
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
                    width={Math.max(0, chartConfig.avgX - 46)}
                    height={Math.max(0, chartConfig.avgY - 30)}
                    fill="#3b82f6"
                    fillOpacity="0.04"
                  />
                  <rect
                    x={chartConfig.avgX}
                    y="30"
                    width={Math.max(0, 446 - chartConfig.avgX)}
                    height={Math.max(0, chartConfig.avgY - 30)}
                    fill="#ef4444"
                    fillOpacity="0.04"
                  />
                  <rect
                    x="46"
                    y={chartConfig.avgY}
                    width={Math.max(0, chartConfig.avgX - 46)}
                    height={Math.max(0, 360 - chartConfig.avgY)}
                    fill="#8b5cf6"
                    fillOpacity="0.04"
                  />
                  <rect
                    x={chartConfig.avgX}
                    y={chartConfig.avgY}
                    width={Math.max(0, 446 - chartConfig.avgX)}
                    height={Math.max(0, 360 - chartConfig.avgY)}
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
                    y1={chartConfig.avgY}
                    x2="446"
                    y2={chartConfig.avgY}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />
                  <line
                    x1={chartConfig.avgX}
                    y1="30"
                    x2={chartConfig.avgX}
                    y2="360"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />

                  {/* 象限名（密集プロットと重ならないよう四隅に固定配置） */}
                  <text
                    x="56"
                    y="46"
                    textAnchor="start"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#60a5fa"
                    opacity="0.65"
                  >
                    {chartConfig.qTopLeft}
                  </text>
                  <text
                    x="436"
                    y="46"
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#f87171"
                    opacity="0.65"
                  >
                    {chartConfig.qTopRight}
                  </text>
                  <text
                    x="56"
                    y="348"
                    textAnchor="start"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#a78bfa"
                    opacity="0.65"
                  >
                    {chartConfig.qBottomLeft}
                  </text>
                  <text
                    x="436"
                    y="348"
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#34d399"
                    opacity="0.65"
                  >
                    {chartConfig.qBottomRight}
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
                    {chartConfig.yTitle}
                  </text>
                  <text
                    x="446"
                    y="398"
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#a3a3a3"
                  >
                    {chartConfig.xTitle}
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
                    {chartConfig.xMinLabel}
                  </text>
                  <text
                    x={chartConfig.avgX}
                    y="376"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#38bdf8"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {chartConfig.xAvgLabel}
                  </text>
                  <text
                    x="446"
                    y="376"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    {chartConfig.xMaxLabel}
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
                    {chartConfig.yMinLabel}
                  </text>
                  <text
                    x="38"
                    y={chartConfig.avgY + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#38bdf8"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {chartConfig.yAvgLabel}
                  </text>
                  <text
                    x="38"
                    y="35"
                    textAnchor="end"
                    fontSize="10"
                    fill="#737373"
                    className="font-mono"
                  >
                    {chartConfig.yMaxLabel}
                  </text>

                  {/* プロット点（選択プレイヤーを最前面に描画） */}
                  {sortedRenderPoints.map((p) => {
                    const isSel = activePlayer?.name === p.name;
                    const color = getAgariColor(p.avgAgari);
                    const textX = p.cx + p.labelDx;
                    const textY = p.cy + p.labelDy;

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
                          strokeWidth={3.5}
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

              {/* 凡例（スマホ幅でも崩れないコンパクト1行レイアウト・動的3分位連動） */}
              <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 text-[11px] text-neutral-400 px-1 border-b border-neutral-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-300 font-bold">平均打点:</span>
                  <span className="flex items-center gap-1 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shrink-0" />
                    ≥{highThreshold.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
                    {lowThreshold.toLocaleString()}~
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                    &lt;{lowThreshold.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 ml-auto">
                  {chartType === 'pca' && pcaResult && (
                    <span className="text-amber-400 font-bold bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                      累積説明率: {pcaResult.cumulativeRatio}%
                    </span>
                  )}
                  <span>
                    対象: <span className="text-white font-bold">{filteredPlayers.length}</span>名
                  </span>
                </div>
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

              {/* 選択プレイヤー詳細カード（チャート種類に応じたスタッツ表示） */}
              {activePlayer && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="mb-2.5 pb-2 border-b border-neutral-800/80">
                    {/* 1行目: 名前と局数（両端配置で絶対に被らない） */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white">
                        {activePlayer.name}
                      </h3>
                      <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                        {activePlayer.kyokuCount}局
                      </span>
                    </div>

                    {/* 2行目: スタイル名バッジ */}
                    <div className="mt-1.5 flex items-center">
                      <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {activeTypeTitle}
                      </span>
                    </div>

                    {/* 3行目: スタイル解説文 */}
                    <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                      {activeTypeDescription}
                    </p>
                  </div>

                  {chartType === 'pca' ? (
                    <div className="space-y-2">
                      {/* PCA主成分得点バッジ */}
                      {(() => {
                        const pScore = pcaResult?.players.find(
                          (item) => item.name === activePlayer.name
                        );
                        return (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono">
                            <span className="text-neutral-400 font-bold">主成分得点:</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sky-400 font-bold">
                                PC1: {pScore && pScore.pc1 > 0 ? '+' : ''}
                                {pScore ? pScore.pc1 : 0}
                              </span>
                              <span className="text-amber-400 font-bold">
                                PC2: {pScore && pScore.pc2 > 0 ? '+' : ''}
                                {pScore ? pScore.pc2 : 0}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 主要6指標 */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
                            流局聴牌率
                          </span>
                          <span className="text-sm font-bold font-mono text-white">
                            {activePlayer.tenpaiRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : chartType === 'agari_houju' ? (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block font-bold">
                          和銃差
                        </span>
                        <span
                          className={`text-sm font-bold font-mono ${
                            activePlayer.agariHoujuDiff >= 0
                              ? 'text-sky-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {activePlayer.agariHoujuDiff >= 0 ? '+' : ''}
                          {activePlayer.agariHoujuDiff}%
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
                          平均放銃打点
                        </span>
                        <span className="text-sm font-bold font-mono text-neutral-300">
                          {activePlayer.avgHouju.toLocaleString()}点
                        </span>
                      </div>
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block font-bold">
                          ツモ率
                        </span>
                        <span className="text-sm font-bold font-mono text-white">
                          {activePlayer.tsumoRate}%
                        </span>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
