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

const SEAT_NAMES = ['東', '南', '西', '北'];

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
      <div
        className={`grid gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 ${
          allowMultiRon ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectWinType('ron')}
          className={`h-11 rounded-lg font-black text-sm transition-all flex items-center justify-center ${
            winType === 'ron'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          ロン
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
          ツモ
        </button>
        {allowMultiRon && (
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
        )}
      </div>

      {/* ─── 和了者選択エリア ─── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-neutral-200">
            {winType === 'multi_ron' ? '和了者（2〜3名）' : '和了者'}
          </span>
          {winType === 'multi_ron' && (
            <span className="text-[11px] text-amber-400 font-bold">
              {multiWinners.length}名選択中
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {players.map((p, idx) => {
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
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-md'
                      : winType === 'multi_ron'
                      ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                      : 'bg-rose-600 border-rose-400 text-white shadow-md'
                    : 'bg-neutral-900 hover:bg-neutral-850 border-neutral-800 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-neutral-500 w-4 text-center shrink-0">
                    {SEAT_NAMES[idx] || ''}
                  </span>
                  <span className="truncate">{p}</span>
                </div>
                {isDealer && (
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${
                      isSelected
                        ? 'bg-black/30 text-white border border-white/30'
                        : 'bg-rose-600 text-white shadow-sm'
                    }`}
                  >
                    親
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 放銃者選択エリア (ロン / ダブロン時のみ) ─── */}
      {winType !== 'tsumo' && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
          <span className="text-xs font-black text-neutral-200">
            放銃者
          </span>
          <div className="grid grid-cols-2 gap-2">
            {players.map((p, idx) => {
              const isSelected = loser === p;
              const isDealer = p === currentDealer;
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
                  className={`h-14 rounded-xl font-black text-sm flex items-center justify-between px-3 border transition-all touch-manipulation ${
                    isWinnerSelected
                      ? 'bg-neutral-950 border-neutral-900 text-neutral-700 cursor-not-allowed opacity-30'
                      : isSelected
                      ? 'bg-orange-600 border-orange-400 text-white shadow-md'
                      : 'bg-neutral-900 hover:bg-neutral-850 border-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-neutral-500 w-4 text-center shrink-0">
                      {SEAT_NAMES[idx] || ''}
                    </span>
                    <span className="truncate">{p}</span>
                  </div>
                  {isDealer && (
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${
                        isSelected
                          ? 'bg-black/30 text-white border border-white/30'
                          : 'bg-rose-600 text-white shadow-sm'
                      }`}
                    >
                      親
                    </span>
                  )}
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
          className={`w-full h-13 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
            canProceed
              ? 'bg-white hover:bg-neutral-200 active:scale-[0.99] text-black'
              : 'bg-neutral-850 text-neutral-600 cursor-not-allowed border border-neutral-800'
          }`}
        >
          点数選択へ進む →
        </button>
      </div>
    </div>
  );
};
