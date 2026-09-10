/**
 * 和了方式選択ステップ (Step 1: ロン / ツモ)
 */

'use client';

import React from 'react';
import { WinType } from '@/types/mahjong';

interface WinTypeStepProps {
  winner: string | null;
  onSelectType: (type: WinType) => void;
  onBack: () => void;
}

export const WinTypeStep: React.FC<WinTypeStepProps> = ({
  winner,
  onSelectType,
  onBack,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-neutral-200">
          Step 2/3: 和了方式を選択 ({winner})
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-400 hover:text-white underline font-bold"
        >
          和了者を変更
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onSelectType('ron')}
          className="h-20 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] border border-rose-500/50 text-white font-black text-xl shadow-md flex items-center justify-center touch-manipulation transition-all"
        >
          ロン和了
        </button>
        <button
          type="button"
          onClick={() => onSelectType('tsumo')}
          className="h-20 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] border border-cyan-500/50 text-white font-black text-xl shadow-md flex items-center justify-center touch-manipulation transition-all"
        >
          ツモ和了
        </button>
      </div>
    </div>
  );
};
