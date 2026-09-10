/**
 * 和了者選択ステップ (Step 0)
 */

'use client';

import React from 'react';

interface WinnerStepProps {
  players: string[];
  currentDealer: string;
  onSelectWinner: (winner: string) => void;
}

export const WinnerStep: React.FC<WinnerStepProps> = ({
  players,
  currentDealer,
  onSelectWinner,
}) => {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm font-black text-neutral-200">
        Step 1/3: 誰が和了？
      </p>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => {
          const isDealer = p === currentDealer;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelectWinner(p)}
              className="h-16 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-700 text-white font-black text-base flex items-center justify-center gap-2 touch-manipulation transition-all"
            >
              <span>{p}</span>
              {isDealer && (
                <span className="px-1.5 py-0.5 rounded bg-rose-700 text-white font-black text-[10px]">
                  親
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
