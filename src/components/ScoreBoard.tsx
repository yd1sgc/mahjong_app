/**
 * スコアボードUIコンポーネント（見た目と描画のみ）
 * mahjong_personal 準拠：縦4行リスト・点差トグル・副露/立直ボタン・完全スクロールレス
 */

'use client';

import React, { useState } from 'react';
import { GameStateSnapshot } from '@/types/mahjong';
import { getDealer, getRoundName } from '@/lib/mahjong/rules';

interface ScoreBoardProps {
  players: string[];
  gameState: GameStateSnapshot | null;
  onRiichiClick?: (player: string) => void;
  onFuroClick?: (player: string) => void;
  isRecorder?: boolean;
}

const SEAT_NAMES = ['東', '南', '西', '北'];

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  players,
  gameState,
  onRiichiClick,
  onFuroClick,
  isRecorder = false,
}) => {
  const [diffTarget, setDiffTarget] = useState<string | null>(null);

  if (!gameState || players.length < 4) {
    return (
      <div className="flex items-center justify-center p-8 text-neutral-400 text-sm font-bold">
        対局データを読み込み中...
      </div>
    );
  }

  const currentDealer = getDealer(players, gameState.roundIdx);
  const roundName = getRoundName(gameState.roundIdx);
  const riichiDeclared = gameState.riichiDeclared || [];
  const furoDeclared = gameState.furoDeclared || [];

  // 点差トグル処理
  const toggleDiffTarget = (player: string) => {
    setDiffTarget((prev) => (prev === player ? null : player));
  };

  return (
    <div className="w-full flex flex-col gap-2 select-none">
      {/* 局情報ヘッダー */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg sm:text-xl font-black text-white tracking-wide">
            {roundName}
          </span>
          <span className="text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-500/40">
            {gameState.honba}本場
          </span>
          <span className="text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-md bg-cyan-950/70 text-cyan-300 border border-cyan-500/40">
            供託{gameState.riichiStick}本
          </span>
        </div>
        <div className="text-xs sm:text-sm font-bold text-neutral-300 ml-auto">
          親: <span className="text-amber-300 font-black">{currentDealer}</span>
        </div>
      </div>

      {/* 4名スコアボード (縦4行リスト) */}
      <div className="flex flex-col gap-1.5">
        {players.map((player, idx) => {
          const score = gameState.scores[player] ?? 0;
          const isDealer = player === currentDealer;
          const isRiichi = riichiDeclared.includes(player);
          const isFuro = furoDeclared.includes(player);
          const isDiffBase = diffTarget === player;
          const inDiffMode = Boolean(diffTarget) && !isDiffBase;

          // 点差計算
          let diffValue = 0;
          if (inDiffMode && diffTarget) {
            const baseScore = gameState.scores[diffTarget] ?? 0;
            diffValue = score - baseScore;
          }

          // 副露と立直の相互排他
          const canRiichi = isRecorder && !isRiichi && !isFuro;
          const canFuro = isRecorder && !isRiichi;

          return (
            <div
              key={player}
              className={`flex items-stretch gap-1.5 p-1 rounded-xl transition-colors ${
                isDiffBase
                  ? 'bg-amber-500/10 border border-amber-500/40'
                  : 'bg-neutral-900/90 border border-neutral-800'
              }`}
            >
              {/* 名前 ＆ 点数/点差ボタン (タップで点差トグル) */}
              <button
                type="button"
                onClick={() => toggleDiffTarget(player)}
                className="flex-1 min-h-[52px] sm:min-h-[58px] px-3 py-1.5 rounded-lg bg-neutral-850 hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center justify-between text-left touch-manipulation"
              >
                {/* 左側: 席・名前・各種状態バッジ */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-6 h-6 shrink-0 rounded bg-neutral-800 text-neutral-300 text-xs font-black flex items-center justify-center border border-neutral-700">
                    {SEAT_NAMES[idx]}
                  </span>
                  <span className="font-black text-sm sm:text-base text-white truncate max-w-[100px] sm:max-w-[140px]">
                    {player}
                  </span>
                  {isDealer && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-700 text-white font-black text-[11px] leading-none">
                      親
                    </span>
                  )}
                  {isDiffBase && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold text-[10px] leading-none">
                      基準
                    </span>
                  )}
                </div>

                {/* 右側: 点数または点差表示 */}
                <div className="text-right shrink-0">
                  {inDiffMode ? (
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-xl sm:text-2xl font-black tracking-tight leading-none ${
                          diffValue >= 0 ? 'text-cyan-400' : 'text-rose-500'
                        }`}
                      >
                        {diffValue >= 0 ? `+${diffValue.toLocaleString()}` : diffValue.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 leading-tight mt-0.5">
                        {score.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`text-xl sm:text-2xl font-black tracking-tight ${
                        score < 0
                          ? 'text-rose-500'
                          : isDealer
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {score.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>

              {/* 副露ボタン */}
              <button
                type="button"
                disabled={!canFuro && !isFuro}
                onClick={() => onFuroClick && onFuroClick(player)}
                className={`w-12 sm:w-14 rounded-lg font-black text-sm sm:text-base flex items-center justify-center transition-all touch-manipulation border ${
                  isFuro
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm'
                    : canFuro
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed'
                }`}
                title={isFuro ? '副露中（タップで解除）' : '副露を宣言'}
              >
                副
              </button>

              {/* 立直ボタン */}
              <button
                type="button"
                disabled={!canRiichi && !isRiichi}
                onClick={() => onRiichiClick && onRiichiClick(player)}
                className={`w-12 sm:w-14 rounded-lg font-black text-sm sm:text-base flex items-center justify-center transition-all touch-manipulation border ${
                  isRiichi
                    ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                    : canRiichi
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed'
                }`}
                title={isRiichi ? '立直宣言済み' : '立直を宣言 (1000点供託)'}
              >
                立
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
