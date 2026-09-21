/**
 * 実力推定・同卓時対戦分析コンポーネント (SkillEstimationSection.tsx)
 * MMC (mahjong-manage.com) 準拠の統計モデル
 * モノトーン基調・アコーディオン折りたたみ・純粋SVG描画
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { GameData } from '@/lib/mahjong/statsCalc';
import {
  calculateSkillEstimation,
  calculateHeadToHeadEstimation,
  SkillEstimationSummary,
  HeadToHeadSummary,
} from '@/lib/mahjong/skillEstimation';

interface SkillEstimationSectionProps {
  selectedRuleName: string;
  effectiveGames: GameData[];
  allPlayerNames: string[];
}

export const SkillEstimationSection: React.FC<SkillEstimationSectionProps> = ({
  selectedRuleName,
  effectiveGames,
  allPlayerNames,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showAllOpponents, setShowAllOpponents] = useState<boolean>(false);

  // 有効プレイヤー（未選択時は先頭プレイヤー）
  const activePlayer = useMemo(() => {
    if (allPlayerNames.length === 0) return null;
    if (selectedPlayer && allPlayerNames.includes(selectedPlayer)) {
      return selectedPlayer;
    }
    return allPlayerNames[0];
  }, [allPlayerNames, selectedPlayer]);

  // トータル実力推定の集計
  const totalSummary: SkillEstimationSummary | null = useMemo(() => {
    if (selectedRuleName === 'all' || !activePlayer) return null;
    return calculateSkillEstimation(effectiveGames, activePlayer);
  }, [selectedRuleName, activePlayer, effectiveGames]);

  // 対戦相手別の同卓時実力比較
  const headToHeadList: HeadToHeadSummary[] = useMemo(() => {
    if (selectedRuleName === 'all' || !activePlayer) return [];
    return calculateHeadToHeadEstimation(effectiveGames, activePlayer);
  }, [selectedRuleName, activePlayer, effectiveGames]);

  // 表示する対戦相手（初期は上位5名）
  const displayedOpponents = useMemo(() => {
    if (showAllOpponents) return headToHeadList;
    return headToHeadList.slice(0, 5);
  }, [headToHeadList, showAllOpponents]);

  return (
    <section className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xs">
      {/* アコーディオンヘッダー */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-850 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-white">実力推定・同卓者分析</h2>
          {selectedRuleName !== 'all' && (
            <span className="text-[11px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md">
              {selectedRuleName}
            </span>
          )}
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

      {/* アコーディオン展開コンテンツ */}
      {isOpen && (
        <div className="border-t border-neutral-800 p-4 flex flex-col gap-4">
          {/* ルール未選択時の注意表示 */}
          {selectedRuleName === 'all' ? (
            <div className="py-8 text-center text-xs text-neutral-400 font-bold leading-relaxed">
              実力推定はウマ・オカが異なるルールを混在集計できません。
              <br />
              上部のフィルターから特定のルールを1つ選択してください。
            </div>
          ) : !activePlayer || !totalSummary ? (
            <div className="py-8 text-center text-xs text-neutral-500 font-bold">
              該当する対局データがありません
            </div>
          ) : (
            <>
              {/* ─── 分析対象プレイヤー選択チップ ─── */}
              <div>
                <span className="text-[11px] font-black text-neutral-400 block mb-1.5">
                  分析対象プレイヤー
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allPlayerNames.map((name) => {
                    const active = name === activePlayer;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedPlayer(name)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-neutral-950 shadow-xs'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── トータル実力推定カード ─── */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-2">
                  <span className="text-xs font-black text-white">
                    {totalSummary.playerName} の実力推定
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {totalSummary.gameCount}戦
                  </span>
                </div>

                {/* 基本統計量グリッド */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block font-bold">平均pt</span>
                    <span
                      className={`text-sm font-black font-mono ${
                        totalSummary.avgPt > 0
                          ? 'text-cyan-400'
                          : totalSummary.avgPt < 0
                            ? 'text-rose-400'
                            : 'text-neutral-200'
                      }`}
                    >
                      {totalSummary.avgPt > 0 ? `+${totalSummary.avgPt.toFixed(2)}` : totalSummary.avgPt.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block font-bold">平均順位</span>
                    <span className="text-sm font-black font-mono text-neutral-200">
                      {totalSummary.avgRank.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block font-bold">標準偏差</span>
                    <span className="text-sm font-black font-mono text-neutral-200">
                      {totalSummary.stdDev.toFixed(1)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block font-bold">標準誤差</span>
                    <span className="text-sm font-black font-mono text-neutral-400">
                      &plusmn;{totalSummary.standardError.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 実力確率グリッド */}
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">
                    期待収支の達成確率（参考）
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                    {totalSummary.probabilities.map((p) => (
                      <div
                        key={p.targetPt}
                        className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800/80"
                      >
                        <span className="text-[9px] text-neutral-500 block font-mono">
                          &ge; {p.targetPt}pt
                        </span>
                        <span
                          className={`text-xs font-mono font-black ${
                            p.probability >= 70
                              ? 'text-cyan-400'
                              : p.probability >= 50
                                ? 'text-neutral-200'
                                : 'text-neutral-500'
                          }`}
                        >
                          {p.probability.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* トータル確率密度SVGチャート */}
                <div className="pt-1">
                  <SingleDistributionSvgChart
                    curve={totalSummary.curve}
                    mean={totalSummary.avgPt}
                    color="#06b6d4"
                  />
                </div>
              </div>

              {/* ─── 同卓者別実力比較（VS相手） ─── */}
              {headToHeadList.length > 0 && (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">同卓者との実力比較</span>
                    <span className="text-[10px] font-bold text-neutral-400">
                      全{headToHeadList.length}名
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {displayedOpponents.map((opp) => (
                      <HeadToHeadCard
                        key={opp.opponentName}
                        data={opp}
                        myName={totalSummary.playerName}
                      />
                    ))}
                  </div>

                  {/* もっと見る / 閉じる ボタン */}
                  {headToHeadList.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOpponents(!showAllOpponents)}
                      className="w-full py-2 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      {showAllOpponents
                        ? '上位5名のみ表示'
                        : `残り ${headToHeadList.length - 5} 名を表示`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};

// ─── 対戦相手別カードコンポーネント ───

interface HeadToHeadCardProps {
  data: HeadToHeadSummary;
  myName: string;
}

const HeadToHeadCard: React.FC<HeadToHeadCardProps> = ({ data, myName }) => {
  const isSuperior = data.strongerThanOpponentProb >= 50.0;

  return (
    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex flex-col gap-2.5">
      {/* カードヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-white">VS {data.opponentName}</span>
          <span className="text-[11px] font-mono text-neutral-400 font-bold">
            ({data.gameCount}戦)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-400 font-bold">優位確率</span>
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-mono font-black ${
              isSuperior
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/50'
                : 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
            }`}
          >
            {data.strongerThanOpponentProb.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 成績対比テーブル */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800/60">
          <span className="text-[10px] text-cyan-400 font-bold font-sans truncate mr-1">
            {myName}
          </span>
          <div className="text-right">
            <span
              className={`font-black ${data.myAvgPt >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}
            >
              {data.myAvgPt >= 0 ? `+${data.myAvgPt.toFixed(1)}` : data.myAvgPt.toFixed(1)}
            </span>
            <span className="text-[10px] text-neutral-400 ml-1">
              ({data.myAvgRank.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800/60">
          <span className="text-[10px] text-rose-400 font-bold font-sans truncate mr-1">
            {data.opponentName}
          </span>
          <div className="text-right">
            <span
              className={`font-black ${data.opponentAvgPt >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}
            >
              {data.opponentAvgPt >= 0
                ? `+${data.opponentAvgPt.toFixed(1)}`
                : data.opponentAvgPt.toFixed(1)}
            </span>
            <span className="text-[10px] text-neutral-400 ml-1">
              ({data.opponentAvgRank.toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* 同卓時2曲線重なりSVGチャート */}
      <div className="pt-0.5">
        <DualDistributionSvgChart
          curve1={data.myCurve}
          curve2={data.opponentCurve}
          color1="#06b6d4"
          color2="#f43f5e"
          label1={myName}
          label2={data.opponentName}
        />
      </div>
    </div>
  );
};

// ─── 単一正規分布SVGチャート ───

interface SingleDistributionSvgChartProps {
  curve: { x: number; y: number }[];
  mean: number;
  color: string;
}

const SingleDistributionSvgChart: React.FC<SingleDistributionSvgChartProps> = ({
  curve,
  mean,
  color,
}) => {
  const width = 360;
  const height = 110;
  const pad = { top: 12, bottom: 22, left: 24, right: 24 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxY = useMemo(() => {
    let m = 0;
    curve.forEach((p) => {
      if (p.y > m) m = p.y;
    });
    return Math.max(m, 0.05);
  }, [curve]);

  const getX = (val: number) => pad.left + ((val - -10) / 20) * plotW;
  const getY = (val: number) => pad.top + plotH - (val / maxY) * plotH;

  const pathD = useMemo(() => {
    return curve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.x).toFixed(1)} ${getY(p.y).toFixed(1)}`)
      .join(' ');
  }, [curve, maxY]);

  const areaD = useMemo(() => {
    const bottomY = pad.top + plotH;
    return `${pathD} L ${getX(10).toFixed(1)} ${bottomY} L ${getX(-10).toFixed(1)} ${bottomY} Z`;
  }, [pathD]);

  const zeroX = getX(0);
  const meanX = getX(Math.max(-10, Math.min(10, mean)));

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[420px] h-auto select-none">
        {/* ベース軸 */}
        <line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={width - pad.right}
          y2={pad.top + plotH}
          stroke="#404040"
          strokeWidth="1"
        />

        {/* 0pt基準線 */}
        <line
          x1={zeroX}
          y1={pad.top}
          x2={zeroX}
          y2={pad.top + plotH}
          stroke="#525252"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
        <text
          x={zeroX}
          y={height - 6}
          fill="#737373"
          fontSize="9"
          textAnchor="middle"
          fontFamily="monospace"
        >
          0
        </text>

        {/* -10, +10 目盛 */}
        <text
          x={pad.left}
          y={height - 6}
          fill="#525252"
          fontSize="9"
          textAnchor="middle"
          fontFamily="monospace"
        >
          -10
        </text>
        <text
          x={width - pad.right}
          y={height - 6}
          fill="#525252"
          fontSize="9"
          textAnchor="middle"
          fontFamily="monospace"
        >
          +10
        </text>

        {/* 塗りつぶし & 曲線 */}
        <path d={areaD} fill={color} fillOpacity="0.12" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

        {/* 平均値マーカー */}
        <line
          x1={meanX}
          y1={pad.top}
          x2={meanX}
          y2={pad.top + plotH}
          stroke={color}
          strokeDasharray="1 2"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

// ─── 同卓時2曲線重なりSVGチャート ───

interface DualDistributionSvgChartProps {
  curve1: { x: number; y: number }[];
  curve2: { x: number; y: number }[];
  color1: string;
  color2: string;
  label1: string;
  label2: string;
}

const DualDistributionSvgChart: React.FC<DualDistributionSvgChartProps> = ({
  curve1,
  curve2,
  color1,
  color2,
  label1,
  label2,
}) => {
  const width = 360;
  const height = 100;
  const pad = { top: 12, bottom: 20, left: 24, right: 24 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxY = useMemo(() => {
    let m = 0;
    curve1.forEach((p) => {
      if (p.y > m) m = p.y;
    });
    curve2.forEach((p) => {
      if (p.y > m) m = p.y;
    });
    return Math.max(m, 0.05);
  }, [curve1, curve2]);

  const getX = (val: number) => pad.left + ((val - -10) / 20) * plotW;
  const getY = (val: number) => pad.top + plotH - (val / maxY) * plotH;

  const pathD1 = useMemo(() => {
    return curve1
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.x).toFixed(1)} ${getY(p.y).toFixed(1)}`)
      .join(' ');
  }, [curve1, maxY]);

  const areaD1 = useMemo(() => {
    const bottomY = pad.top + plotH;
    return `${pathD1} L ${getX(10).toFixed(1)} ${bottomY} L ${getX(-10).toFixed(1)} ${bottomY} Z`;
  }, [pathD1]);

  const pathD2 = useMemo(() => {
    return curve2
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.x).toFixed(1)} ${getY(p.y).toFixed(1)}`)
      .join(' ');
  }, [curve2, maxY]);

  const areaD2 = useMemo(() => {
    const bottomY = pad.top + plotH;
    return `${pathD2} L ${getX(10).toFixed(1)} ${bottomY} L ${getX(-10).toFixed(1)} ${bottomY} Z`;
  }, [pathD2]);

  const zeroX = getX(0);

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[420px] h-auto select-none">
        {/* ベース軸 */}
        <line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={width - pad.right}
          y2={pad.top + plotH}
          stroke="#333333"
          strokeWidth="1"
        />

        {/* 0pt基準線 */}
        <line
          x1={zeroX}
          y1={pad.top}
          x2={zeroX}
          y2={pad.top + plotH}
          stroke="#404040"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
        <text
          x={zeroX}
          y={height - 5}
          fill="#525252"
          fontSize="8"
          textAnchor="middle"
          fontFamily="monospace"
        >
          0
        </text>

        {/* 曲線1（自分） */}
        <path d={areaD1} fill={color1} fillOpacity="0.10" />
        <path d={pathD1} fill="none" stroke={color1} strokeWidth="1.5" strokeLinecap="round" />

        {/* 曲線2（相手） */}
        <path d={areaD2} fill={color2} fillOpacity="0.10" />
        <path d={pathD2} fill="none" stroke={color2} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};
