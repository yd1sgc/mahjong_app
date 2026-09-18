/**
 * スコアボードUIコンポーネント（見た目と描画のみ）
 * mahjong_personal 準拠：縦4行リスト・点差トグル・副露/立直ボタン・完全スクロールレス
 */

'use client';

import React, { useState } from 'react';
import { GameStateSnapshot, RuleConfig } from '@/types/mahjong';
import { getDealer, getRoundName, canDeclareRiichi } from '@/lib/mahjong/rules';

interface ScoreBoardProps {
  players: string[];
  gameState: GameStateSnapshot | null;
  ruleConfig?: RuleConfig;
  onRiichiClick?: (player: string) => void;
  onFuroClick?: (player: string) => void;
  isRecorder?: boolean;
}

const SEAT_NAMES = ['東', '南', '西', '北'];

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  players,
  gameState,
  ruleConfig,
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
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 sm:py-3 shadow-md">
        <div className="flex items-center gap-3">
          {/* 局名（24px〜28px・白極太） */}
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
            {roundName}
          </span>

          {/* ディバイダー（縦の仕切り線） */}
          <div className="h-6 w-[1.5px] bg-neutral-700/80 rounded-full mx-0.5 shrink-0" />

          {/* バッジ群（文字15px太字 ＋ 数字22px〜24px超極太） */}
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 leading-none shadow-sm">
              <span className="text-xl sm:text-2xl font-black font-mono leading-none tracking-tight">
                {gameState.honba}
              </span>
              <span className="text-sm sm:text-base font-black leading-none">
                本場
              </span>
            </div>

            <div className="flex items-baseline gap-1 px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 leading-none shadow-sm">
              <span className="text-sm sm:text-base font-black leading-none">
                供託
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono leading-none tracking-tight">
                {gameState.riichiStick}
              </span>
            </div>
          </div>
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

          // 副露と立直の相互排他および最低持ち点チェック
          const canRiichi = isRecorder && !isRiichi && canDeclareRiichi(score, ruleConfig || {}, isFuro);
          const canFuro = isRecorder && !isRiichi;

          return (
            <div
              key={player}
              className={`flex items-stretch gap-2 p-1.5 rounded-xl transition-colors border ${
                isDealer ? 'border-l-4 border-l-rose-500' : ''
              } ${
                isDiffBase
                  ? 'bg-amber-500/10 border-amber-500/40'
                  : 'bg-neutral-900/90 border-neutral-800'
              }`}
            >
              {/* 名前 ＆ 点数/点差ボタン (2段化・タップで点差トグル) */}
              <button
                type="button"
                onClick={() => toggleDiffTarget(player)}
                className="flex-1 h-[72px] sm:h-[76px] px-3.5 py-2 rounded-lg bg-neutral-850 hover:bg-neutral-800 active:scale-[0.99] transition-all flex flex-col justify-between text-left touch-manipulation"
              >
                {/* 上段: 席・名前・各種状態バッジ */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-5 h-5 shrink-0 rounded bg-neutral-800 text-neutral-300 text-xs font-black flex items-center justify-center border border-neutral-700">
                    {SEAT_NAMES[idx]}
                  </span>
                  <span className="font-black text-sm sm:text-base text-neutral-200 truncate max-w-[110px] sm:max-w-[150px]">
                    {player}
                  </span>
                  {isDealer && (
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-xs leading-none shadow-sm">
                      親
                    </span>
                  )}
                </div>

                {/* 下段: 点数または点差表示 (高さ固定・底辺揃えで完全静止、点差時は素点左・点差右の両端配置) */}
                <div className={`h-8 sm:h-9 flex items-end leading-none ${inDiffMode ? 'justify-between' : 'justify-end'}`}>
                  {inDiffMode ? (
                    <>
                      <span className="text-xs sm:text-sm font-mono font-bold text-neutral-400 pb-0.5">
                        {score.toLocaleString()}
                      </span>
                      <span
                        className={`text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none ${
                          diffValue >= 0 ? 'text-cyan-400' : 'text-rose-500'
                        }`}
                      >
                        {diffValue >= 0 ? `+${diffValue.toLocaleString()}` : diffValue.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white leading-none">
                      {score.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>

              {/* 副露ボタン (幅68px・大型化・2文字固定) */}
              <button
                type="button"
                disabled={!canFuro && !isFuro}
                onClick={() => onFuroClick && onFuroClick(player)}
                className={`w-[68px] sm:w-[72px] rounded-xl font-black flex flex-col items-center justify-center transition-all touch-manipulation border ${
                  isFuro
                    ? 'bg-cyan-400 border-cyan-300 text-black shadow-sm'
                    : canFuro
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-400 border-neutral-700'
                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed'
                }`}
                title={isFuro ? '副露（タップで解除）' : '副露を宣言'}
              >
                <span className="text-xs font-black leading-none">
                  副露
                </span>
              </button>

              {/* 立直ボタン (幅68px・大型化・2文字固定) */}
              <button
                type="button"
                disabled={!canRiichi && !isRiichi}
                onClick={() => onRiichiClick && onRiichiClick(player)}
                className={`w-[68px] sm:w-[72px] rounded-xl font-black flex flex-col items-center justify-center transition-all touch-manipulation border ${
                  isRiichi
                    ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                    : canRiichi
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-400 border-neutral-700'
                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed'
                }`}
                title={isRiichi ? '立直（タップで解除）' : '立直を宣言'}
              >
                <span className="text-xs font-black leading-none">
                  立直
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
