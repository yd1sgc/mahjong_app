/**
 * 和了種別（ロン/ツモ/ダブロン）および関係者（和了者・放銃者）統合選択ステップ
 * 従来の3画面遷移（和了者 -> 方式 -> 放銃者）を1画面に集約し、手数を劇的に削減
 */

'use client';

import React from 'react';
import { WinType } from '@/types/mahjong';

interface WinnerAndLoserStepProps {
  players: string[];
  currentDealer: string;
  winType: WinType;
  winner: string | null;
  loser: string | null;
  multiWinners: string[];
  allowMultiRon: boolean;
  onSelectWinType: (type: WinType) => void;
  onSelectWinner: (player: string) => void;
  onSelectLoser: (player: string) => void;
  onToggleMultiWinner: (player: string) => void;
  onNext: () => void;
}

export const WinnerAndLoserStep: React.FC<WinnerAndLoserStepProps> = ({
  players,
  currentDealer,
  winType,
  winner,
  loser,
  multiWinners,
  allowMultiRon,
  onSelectWinType,
  onSelectWinner,
  onSelectLoser,
  onToggleMultiWinner,
  onNext,
}) => {
  // 次へ進めるかどうかのバリデーション
  const canProceed = (() => {
    if (winType === 'tsumo') {
      return Boolean(winner);
    }
    if (winType === 'ron') {
      return Boolean(winner && loser && winner !== loser);
    }
    if (winType === 'multi_ron') {
      return multiWinners.length >= 2 && Boolean(loser) && !multiWinners.includes(loser!);
    }
    return false;
  })();

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── 最上部: 和了種別タブ ─── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-neutral-400">
          Step 1/3: 和了種別と関係者を選択
        </span>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => onSelectWinType('ron')}
            className={`h-11 rounded-lg font-black text-sm transition-all flex items-center justify-center ${
              winType === 'ron'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ロン和了
          </button>
          <button
            type="button"
            onClick={() => onSelectWinType('tsumo')}
            className={`h-11 rounded-lg font-black text-sm transition-all flex items-center justify-center ${
              winType === 'tsumo'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ツモ和了
          </button>
          {/* ルールで許可されている場合のみダブロンタブを表示（方式A） */}
          {allowMultiRon ? (
            <button
              type="button"
              onClick={() => onSelectWinType('multi_ron')}
              className={`h-11 rounded-lg font-black text-sm transition-all flex items-center justify-center ${
                winType === 'multi_ron'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ダブロン
            </button>
          ) : (
            <div className="flex items-center justify-center text-[11px] text-neutral-600 font-bold">
              ダブロン無効
            </div>
          )}
        </div>
      </div>

      {/* ─── 和了者選択エリア ─── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-neutral-200">
            {winType === 'multi_ron'
              ? '和了者（2名または3名選択）'
              : '和了者を選択'}
          </span>
          {winType === 'multi_ron' && (
            <span className="text-[11px] text-amber-400 font-bold">
              {multiWinners.length}名選択中
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => {
            const isDealer = p === currentDealer;
            const isSelected =
              winType === 'multi_ron'
                ? multiWinners.includes(p)
                : winner === p;

            return (
              <button
                key={`winner-${p}`}
                type="button"
                onClick={() => {
                  if (winType === 'multi_ron') {
                    onToggleMultiWinner(p);
                  } else {
                    onSelectWinner(p);
                  }
                }}
                className={`h-14 rounded-xl font-black text-sm flex items-center justify-between px-3 border transition-all touch-manipulation ${
                  isSelected
                    ? winType === 'tsumo'
                      ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 shadow-sm'
                      : winType === 'multi_ron'
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200 shadow-sm'
                      : 'bg-rose-600/30 border-rose-400 text-rose-200 shadow-sm'
                    : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{p}</span>
                  {isDealer && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      親
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold opacity-80">
                  {isSelected ? '和了' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 放銃者選択エリア (ロン / ダブロン時のみ) ─── */}
      {winType !== 'tsumo' && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800/80">
          <span className="text-xs font-black text-neutral-200">
            放銃者（ロンされた人）を選択
          </span>
          <div className="grid grid-cols-2 gap-2">
            {players.map((p) => {
              const isSelected = loser === p;
              // 和了者は放銃者として選択不可
              const isWinnerSelected =
                winType === 'multi_ron'
                  ? multiWinners.includes(p)
                  : winner === p;

              return (
                <button
                  key={`loser-${p}`}
                  type="button"
                  disabled={isWinnerSelected}
                  onClick={() => onSelectLoser(p)}
                  className={`h-13 rounded-xl font-black text-sm flex items-center justify-between px-3 border transition-all touch-manipulation ${
                    isWinnerSelected
                      ? 'bg-neutral-900 border-neutral-850 text-neutral-650 cursor-not-allowed opacity-40'
                      : isSelected
                      ? 'bg-orange-600/30 border-orange-500 text-orange-200 shadow-sm'
                      : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
                  }`}
                >
                  <span>{p}</span>
                  <span className="text-xs font-bold opacity-80">
                    {isSelected ? '放銃' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 次へ進むボタン ─── */}
      <div className="pt-2">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className={`w-full h-12 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
            canProceed
              ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black'
              : 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-750'
          }`}
        >
          点数選択へ進む &rarr;
        </button>
      </div>
    </div>
  );
};
