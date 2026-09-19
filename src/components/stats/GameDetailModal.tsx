/**
 * 対局詳細ポップアップモーダルコンポーネント (GameDetailModal.tsx)
 * 該当対局の最終順位、素点、pt、および各局の履歴一覧表示
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GameData, RoundData } from '@/lib/mahjong/statsCalc';
import { RuleDetailModal } from '@/components/RuleDetailModal';
import { supabase } from '@/lib/supabase';

interface GameDetailModalProps {
  game: GameData | null;
  rounds: RoundData[];
  onClose: () => void;
}

const PLAYER_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  rounds: initialRounds,
  onClose,
}) => {
  const [showRuleDetail, setShowRuleDetail] = useState(false);
  const [detailRounds, setDetailRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(false);

  // 対象試合の局詳細・席詳細データをピンポイントでオンデマンド取得
  useEffect(() => {
    if (!game) {
      setDetailRounds([]);
      return;
    }

    let isMounted = true;
    const fetchGameRounds = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('rounds')
          .select('*, round_seats(*)')
          .eq('game_id', game.game_id)
          .order('round_index', { ascending: true });

        if (error) throw error;

        if (isMounted && data) {
          type RoundWithSeats = {
            round_id: string;
            game_id: string;
            round_index: number;
            kyoku_name: string;
            honba: number;
            result_type: string;
            round_seats: {
              seat: number;
              member_id: string;
              base_point: number;
              honba_point: number;
              kyotaku_point: number;
              penalty_point: number;
              score_delta: number;
              is_winner: number;
              is_loser: number;
              is_riichi: number;
              is_furo: number;
              is_tenpai: number;
            }[];
          };

          const mapped: RoundData[] = (data as unknown as RoundWithSeats[]).map((r) => ({
            round_id: r.round_id,
            game_id: r.game_id,
            round_index: r.round_index,
            kyoku_name: r.kyoku_name,
            honba: r.honba,
            result_type: r.result_type,
            seats: (r.round_seats || []).map((s) => ({
              seat: s.seat,
              member_id: s.member_id,
              score_delta: s.score_delta || 0,
              base_point: s.base_point || 0,
              honba_point: s.honba_point || 0,
              kyotaku_point: s.kyotaku_point || 0,
              penalty_point: s.penalty_point || 0,
              is_winner: Number(s.is_winner) || 0,
              is_loser: Number(s.is_loser) || 0,
              is_riichi: Number(s.is_riichi) || 0,
              is_furo: Number(s.is_furo) || 0,
              is_tenpai: Number(s.is_tenpai) || 0,
            })),
          }));

          setDetailRounds(mapped);
        }
      } catch (err) {
        console.error('局詳細のオンデマンド取得失敗:', err);
        // 万が一通信失敗時は親から渡された初期roundsをフォールバックとして使用
        if (isMounted) setDetailRounds(initialRounds);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchGameRounds();

    return () => {
      isMounted = false;
    };
  }, [game?.game_id]);

  // 表示・計算に使用する有効な局データ
  const effectiveRounds = detailRounds.length > 0 ? detailRounds : initialRounds;

  // 局ごとの4名持ち点推移計算（グラフ用）
  const scoreTrends = useMemo(() => {
    if (!game || effectiveRounds.length === 0) return null;
    const initialPoints: number =
      Number(game.rule_config?.basic?.init_score) ||
      Number(game.rule_config?.init_score) ||
      25000;
    const sortedParticipants = [...game.participants].sort((a, b) => a.seat - b.seat);

    // member_idごとの現在の持ち点
    const currentScores = new Map<string, number>();
    sortedParticipants.forEach((p) => {
      currentScores.set(p.member_id, initialPoints);
    });

    const steps: { label: string; scores: Record<string, number> }[] = [];

    // 初期状態（配給）
    const initialScoreMap: Record<string, number> = {};
    sortedParticipants.forEach((p) => {
      initialScoreMap[p.member_id] = initialPoints;
    });
    steps.push({ label: '配給', scores: initialScoreMap });

    // 各局を順に累積
    const sorted = [...effectiveRounds].sort((a, b) => a.round_index - b.round_index);
    let minScore = initialPoints;
    let maxScore = initialPoints;

    sorted.forEach((r) => {
      const stepScores: Record<string, number> = {};
      sortedParticipants.forEach((p) => {
        const seat = r.seats.find((s) => s.member_id === p.member_id);
        const delta = seat ? seat.score_delta : 0;
        const prev = currentScores.get(p.member_id) || initialPoints;
        const next = prev + delta;
        currentScores.set(p.member_id, next);
        stepScores[p.member_id] = next;

        if (next < minScore) minScore = next;
        if (next > maxScore) maxScore = next;
      });

      const shortLabel = r.kyoku_name.replace('局', '');
      steps.push({ label: shortLabel, scores: stepScores });
    });

    return {
      participants: sortedParticipants,
      steps,
      initialPoints,
      minScore,
      maxScore,
    };
  }, [game, effectiveRounds]);

  if (!game) return null;

  const sortedRounds = [...effectiveRounds].sort((a, b) => a.round_index - b.round_index);

  // SVGグラフのスケール計算
  let chartLayout = null;
  if (scoreTrends && scoreTrends.steps.length > 1) {
    const { minScore, maxScore, initialPoints, steps } = scoreTrends;
    const yMin = Math.min(minScore - 2000, initialPoints - 10000);
    const yMax = Math.max(maxScore + 2000, initialPoints + 10000);
    const range = Math.max(1, yMax - yMin);

    const width = Math.max(340, steps.length * 36);
    const height = 140;
    const pad = { top: 16, bottom: 24, left: 36, right: 16 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const getY = (score: number) => pad.top + plotH - ((score - yMin) / range) * plotH;
    const getX = (idx: number) => pad.left + (idx / Math.max(1, steps.length - 1)) * plotW;
    const baseLineY = getY(initialPoints);

    chartLayout = {
      width,
      height,
      pad,
      yMin,
      yMax,
      getY,
      getX,
      baseLineY,
      initialPoints,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
        
        {/* ─── ヘッダー ─── */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white">対局詳細</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-neutral-400 font-bold">
                {game.played_at.slice(0, 16).replace('T', ' ')} / {game.rule_name}
              </span>
              <button
                type="button"
                onClick={() => setShowRuleDetail(true)}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline"
              >
                ルール詳細
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* ─── 最終成績 ─── */}
        <div>
          <span className="text-xs font-black text-neutral-400 block mb-1.5">最終成績</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {game.participants.map((p) => (
              <div key={p.seat} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400">
                  <span className={p.rank === 1 ? 'text-white' : ''}>{p.rank}位</span>
                  <span>{p.final_score.toLocaleString()}点</span>
                </div>
                <span className="text-sm font-black text-white mt-1">{p.name}</span>
                <span
                  className={`text-xs font-black font-mono mt-0.5 ${
                    p.point > 0 ? 'text-cyan-400' : p.point < 0 ? 'text-rose-500' : 'text-neutral-300'
                  }`}
                >
                  {p.point > 0 ? `+${p.point.toFixed(1)}` : p.point.toFixed(1)} pt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 局履歴（1局1行の極めてシンプルなテーブル） ─── */}
        <div>
          <span className="text-xs font-black text-neutral-400 block mb-1.5">
            局履歴（全 {sortedRounds.length} 局）
          </span>
          {sortedRounds.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
              詳細局データがありません。
            </div>
          ) : (
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <tbody className="divide-y divide-neutral-850">
                  {sortedRounds.map((r, idx) => {
                    const winnerSeat = r.seats.find((s) => Number(s.is_winner) === 1);
                    const loserSeat = r.seats.find((s) => Number(s.is_loser) === 1);

                    let resultNode: React.ReactNode = null;
                    let scoreNode: React.ReactNode = null;

                    if (winnerSeat) {
                      const winnerP = game.participants.find((p) => p.member_id === winnerSeat.member_id);
                      const winnerName = winnerP?.name || '不明';

                      if (loserSeat) {
                        // ロン和了 (← で放銃者を表示・矢印の位置を固定幅で整列)
                        const loserP = game.participants.find((p) => p.member_id === loserSeat.member_id);
                        const loserName = loserP?.name || '不明';
                        resultNode = (
                          <div className="flex items-center gap-1.5">
                            <span className="w-16 shrink-0 font-black text-white truncate">{winnerName}</span>
                            <span className="text-neutral-500 text-[11px] font-normal flex items-center gap-1">
                              <span>←</span>
                              <span className="text-neutral-300">{loserName}</span>
                            </span>
                          </div>
                        );
                      } else {
                        // ツモ和了 (矢印なしで名前のみ)
                        resultNode = (
                          <div className="flex items-center gap-1.5">
                            <span className="w-16 shrink-0 font-black text-white truncate">{winnerName}</span>
                          </div>
                        );
                      }

                      const rawScore = winnerSeat.base_point > 0 ? winnerSeat.base_point : winnerSeat.score_delta;
                      scoreNode = (
                        <span className="font-black font-mono text-white">
                          {rawScore > 0 ? rawScore.toLocaleString() : '-'}
                        </span>
                      );
                    } else if (r.result_type === 'tsumo') {
                      resultNode = <span className="text-white font-bold">ツモ和了</span>;
                      scoreNode = <span className="text-neutral-600 font-mono">-</span>;
                    } else if (r.result_type === 'ron') {
                      resultNode = <span className="text-white font-bold">ロン和了</span>;
                      scoreNode = <span className="text-neutral-600 font-mono">-</span>;
                    } else {
                      // 流局
                      resultNode = <span className="text-neutral-400 font-bold">流局</span>;
                      scoreNode = <span className="text-neutral-600 font-mono">-</span>;
                    }

                    return (
                      <tr key={r.round_id || idx} className="hover:bg-neutral-900/40">
                        <td className="py-2.5 px-3 font-bold text-neutral-300 w-20 whitespace-nowrap">
                          {r.kyoku_name}
                          {r.honba > 0 && (
                            <span className="ml-1 text-[10px] text-neutral-500 font-normal">
                              {r.honba}本
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">{resultNode}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">{scoreNode}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── 点数推移折れ線グラフ ─── */}
        {scoreTrends && chartLayout && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-neutral-400">点数推移</span>
              <span className="text-[10px] text-neutral-500 font-mono">
                原点: {chartLayout.initialPoints.toLocaleString()}
              </span>
            </div>

            <div className="w-full bg-neutral-950 rounded-xl border border-neutral-850 p-2 overflow-x-auto">
              <svg width={chartLayout.width} height={chartLayout.height} className="block mx-auto">
                {/* 原点基準線 */}
                <line
                  x1={chartLayout.pad.left}
                  y1={chartLayout.baseLineY}
                  x2={chartLayout.width - chartLayout.pad.right}
                  y2={chartLayout.baseLineY}
                  stroke="#333333"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={chartLayout.pad.left - 4}
                  y={chartLayout.baseLineY + 3}
                  textAnchor="end"
                  fill="#737373"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {(chartLayout.initialPoints / 1000).toFixed(0)}k
                </text>

                {/* Y軸 上限・下限ラベル */}
                <text
                  x={chartLayout.pad.left - 4}
                  y={chartLayout.pad.top + 6}
                  textAnchor="end"
                  fill="#525252"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {(chartLayout.yMax / 1000).toFixed(0)}k
                </text>
                <text
                  x={chartLayout.pad.left - 4}
                  y={chartLayout.height - chartLayout.pad.bottom}
                  textAnchor="end"
                  fill="#525252"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {(chartLayout.yMin / 1000).toFixed(0)}k
                </text>

                {/* X軸 局ラベル */}
                {scoreTrends.steps.map((step, idx) => (
                  <text
                    key={idx}
                    x={chartLayout.getX(idx)}
                    y={chartLayout.height - 8}
                    textAnchor="middle"
                    fill="#737373"
                    fontSize="8"
                  >
                    {step.label}
                  </text>
                ))}

                {/* 4名の折れ線 */}
                {scoreTrends.participants.map((p, pIdx) => {
                  const color = PLAYER_COLORS[pIdx % PLAYER_COLORS.length];
                  const pts = scoreTrends.steps
                    .map((step, idx) => `${chartLayout.getX(idx)},${chartLayout.getY(step.scores[p.member_id] || 0)}`)
                    .join(' ');

                  const lastScore = scoreTrends.steps[scoreTrends.steps.length - 1]?.scores[p.member_id] || 0;

                  return (
                    <g key={p.member_id}>
                      <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={pts}
                      />
                      <circle
                        cx={chartLayout.getX(scoreTrends.steps.length - 1)}
                        cy={chartLayout.getY(lastScore)}
                        r="3"
                        fill={color}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* プレイヤー凡例 */}
              <div className="grid grid-cols-4 gap-1 mt-1.5 text-center text-[10px] font-bold">
                {scoreTrends.participants.map((p, pIdx) => {
                  const color = PLAYER_COLORS[pIdx % PLAYER_COLORS.length];
                  return (
                    <div key={p.member_id} className="flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-white truncate">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── 閉じるボタン ─── */}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-black transition-colors mt-1"
        >
          閉じる
        </button>

        {showRuleDetail && (
          <RuleDetailModal
            ruleName={game.rule_name}
            config={game.rule_config}
            onClose={() => setShowRuleDetail(false)}
          />
        )}
      </div>
    </div>
  );
};
