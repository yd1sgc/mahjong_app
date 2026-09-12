/**
 * 最終確認 ＆ コミットステップ (Step 3: ロン・ツモ・ダブロン対応)
 */

'use client';

import React from 'react';
import { WinType, MultiWinnerDraft } from '@/types/mahjong';

interface ConfirmStepProps {
  winner: string | null;
  loser: string | null;
  winType: WinType;
  baseScore: number;
  honba: number;
  riichiSticks: number;
  honbaPt: number;
  riichiPt: number;
  totalReceive: number;
  multiWinners: MultiWinnerDraft[];
  closestWinner: string;
  submitting: boolean;
  onCommit: () => void;
  onBack: () => void;
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({
  winner,
  loser,
  winType,
  baseScore,
  honba,
  riichiSticks,
  honbaPt,
  riichiPt,
  totalReceive,
  multiWinners,
  closestWinner,
  submitting,
  onCommit,
  onBack,
}) => {
  const isMulti = winType === 'multi_ron';

  // ダブロン時の放銃者総支払額
  const multiTotalPayment = isMulti
    ? multiWinners.reduce((sum, w) => sum + w.score + honbaPt, 0)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 通常和了（ロン/ツモ）の確認 ─── */}
      {!isMulti ? (
        <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-neutral-400">
            和了内容の確認（{winType === 'ron' ? 'ロン和了' : 'ツモ和了'}）
          </div>

          <div className="flex items-center justify-between text-base font-black text-white">
            <span>
              {winner} {winType === 'ron' ? `(放銃: ${loser})` : '(ツモ)'}
            </span>
            <span className="text-amber-300 font-mono">
              素点 {baseScore.toLocaleString()}点
            </span>
          </div>

          {(honba > 0 || riichiSticks > 0) && (
            <div className="text-xs text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-850 font-mono">
              <span>
                加算 ({honba}本場 {honbaPt > 0 ? `+${honbaPt.toLocaleString()}点` : ''} / 供託{riichiSticks}本 {riichiPt > 0 ? `+${riichiPt.toLocaleString()}点` : ''})
              </span>
              <span className="text-neutral-200 font-bold">
                +{(honbaPt + riichiPt).toLocaleString()}点
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-lg font-black text-white">
            <span>受取総点</span>
            <span className="text-xl text-cyan-400 font-mono font-black">
              {totalReceive.toLocaleString()} 点
            </span>
          </div>
        </div>
      ) : (
        /* ─── ダブロン時の確認 ─── */
        <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
            <span className="text-xs font-black text-amber-300">
              ダブロン内容の確認
            </span>
            <span className="text-xs text-rose-400 font-bold font-mono">
              放銃者: {loser} (-{multiTotalPayment.toLocaleString()}点)
            </span>
          </div>

          {/* 各和了者の受取内訳 */}
          <div className="flex flex-col gap-2">
            {multiWinners.map((w) => {
              const isClosest = w.winner === closestWinner;
              const myKyotaku = isClosest ? riichiPt : 0;
              const myTotal = w.score + honbaPt + myKyotaku;

              return (
                <div
                  key={w.winner}
                  className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-amber-300">{w.winner}</span>
                      {isClosest && riichiSticks > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          上家取り (供託+{myKyotaku.toLocaleString()}点)
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-cyan-400 font-black text-sm">
                      {myTotal.toLocaleString()}点 受取
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-400 font-mono flex items-center justify-between">
                    <span>
                      素点 {w.score.toLocaleString()}点 + 本場 {honbaPt.toLocaleString()}点
                      {isClosest && riichiPt > 0 ? ` + 供託 ${riichiPt.toLocaleString()}点` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 操作ボタン ─── */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs transition-colors"
        >
          やり直す
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onCommit}
          className="flex-2 h-12 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] disabled:opacity-50 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
        >
          {submitting ? '記録中...' : '和了を確定して次局へ'}
        </button>
      </div>
    </div>
  );
};
