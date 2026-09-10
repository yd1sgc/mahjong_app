/**
 * 放銃者選択ステップ (Step 3: ロン和了時のみ)
 */

'use client';

import React from 'react';

interface LoserStepProps {
  players: string[];
  winner: string | null;
  onSelectLoser: (loser: string) => void;
  onBack: () => void;
}

export const LoserStep: React.FC<LoserStepProps> = ({
  players,
  winner,
  onSelectLoser,
  onBack,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-neutral-200">
          放銃者を選択 (ロンされた人)
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-400 hover:text-white underline font-bold"
        >
          点数を変更
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {players
          .filter((p) => p !== winner)
          .map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSelectLoser(p)}
              className="h-16 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-700 text-white font-black text-sm flex items-center justify-center touch-manipulation transition-all"
            >
              {p}
            </button>
          ))}
      </div>
    </div>
  );
};
