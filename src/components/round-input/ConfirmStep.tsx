/**
 * 最終確認 ＆ コミットステップ (Step 4)
 */

'use client';

import React from 'react';
import { WinType } from '@/types/mahjong';

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
  submitting,
  onCommit,
  onBack,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-2">
        <div className="text-xs font-bold text-neutral-400">和了内容の確認</div>
        <div className="flex items-center justify-between text-base font-black text-white">
          <span>
            {winner} {winType === 'ron' ? `(放銃: ${loser})` : '(ツモ)'}
          </span>
          <span className="text-amber-300">
            素点 {baseScore.toLocaleString()}点
          </span>
        </div>

        {(honba > 0 || riichiSticks > 0) && (
          <div className="text-xs text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-850">
            <span>本場・供託加算</span>
            <span className="text-neutral-200 font-bold">
              +{(honbaPt + riichiPt).toLocaleString()}点
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-lg font-black text-white">
          <span>受取総点</span>
          <span className="text-xl text-cyan-400 font-black">
            {totalReceive.toLocaleString()} 点
          </span>
        </div>
      </div>

      <div className="flex gap-2">
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
          className="flex-2 h-12 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
        >
          {submitting ? '記録中...' : '和了を確定して次局へ'}
        </button>
      </div>
    </div>
  );
};
