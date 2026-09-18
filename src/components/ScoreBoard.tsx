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
    <div className="w-full flex flex-col gap-1.5 sm:gap-2 select-none">
      {/* 局情報ヘッダー */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-3 sm:px-3.5 py-1.5 sm:py-2 shadow-sm shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide">
            {roundName}
          </span>
          <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-500/40">
            {gameState.honba}本場
          </span>
          <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-md bg-cyan-950/70 text-cyan-300 border border-cyan-500/40">
            供託{gameState.riichiStick}本
          </span>
        </div>
        <div className="text-xs sm:text-sm font-bold text-neutral-300 ml-auto">
          親: <span className="text-amber-300 font-black">{currentDealer}</span>
        </div>
      </div>

      {/* 4名スコアボード (縦4行リスト) */}
      <div className="flex flex-col gap-1 sm:gap-1.5">
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
              className={`flex items-stretch gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl transition-colors ${
                isDiffBase
                  ? 'bg-amber-500/10 border border-amber-500/40'
                  : 'bg-neutral-900/90 border border-neutral-800'
              }`}
            >
              {/* 名前 ＆ 点数/点差ボタン (2段化・タップで点差トグル) */}
              <button
                type="button"
                onClick={() => toggleDiffTarget(player)}
                className="flex-1 min-h-[58px] sm:min-h-[64px] px-3 py-1.5 sm:py-2 rounded-lg bg-neutral-850 hover:bg-neutral-800 active:scale-[0.99] transition-all flex flex-col justify-between text-left touch-manipulation"
              >
                {/* 上段: 席・名前・各種状態バッジ */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 rounded bg-neutral-800 text-neutral-300 text-[11px] sm:text-xs font-black flex items-center justify-center border border-neutral-700">
                    {SEAT_NAMES[idx]}
                  </span>
                  <span className="font-black text-xs sm:text-sm md:text-base text-neutral-200 truncate max-w-[100px] sm:max-w-[150px]">
                    {player}
                  </span>
                  {isDealer && (
                    <span className="shrink-0 px-1 sm:px-1.5 py-0.5 rounded bg-rose-700 text-white font-black text-[9px] sm:text-[10px] leading-none">
                      親
                    </span>
                  )}
                  {isDiffBase && (
                    <span className="shrink-0 px-1 sm:px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold text-[9px] sm:text-[10px] leading-none">
                      基準
                    </span>
                  )}
                </div>

                {/* 下段: 点数または点差表示 (特大フォント) */}
                <div className="text-right leading-none pt-0.5 sm:pt-1">
                  {inDiffMode ? (
                    <div className="flex items-baseline justify-end gap-1.5 sm:gap-2">
                      <span className="text-[11px] sm:text-xs font-mono font-bold text-neutral-400">
                        {score.toLocaleString()}
                      </span>
                      <span
                        className={`text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-tight ${
                          diffValue >= 0 ? 'text-cyan-400' : 'text-rose-500'
                        }`}
                      >
                        {diffValue >= 0 ? `+${diffValue.toLocaleString()}` : diffValue.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-tight ${
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
                className={`w-[60px] sm:w-[68px] rounded-xl font-black flex flex-col items-center justify-center transition-all touch-manipulation border ${
                  isFuro
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm'
                    : canFuro
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed'
                }`}
                title={isFuro ? '副露中（タップで解除）' : '副露を宣言'}
              >
                <span className="text-xs font-black leading-none">
                  {isFuro ? '副露中' : '副露'}
                </span>
              </button>

              {/* 立直ボタン */}
              <button
                type="button"
                disabled={!canRiichi && !isRiichi}
                onClick={() => onRiichiClick && onRiichiClick(player)}
                className={`w-[60px] sm:w-[68px] rounded-xl font-black flex flex-col items-center justify-center gap-0.5 transition-all touch-manipulation border ${
                  isRiichi
                    ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                    : canRiichi
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-amber-300 border-neutral-700'
                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 opacity-40 cursor-not-allowed'
                }`}
                title={isRiichi ? '立直宣言済み' : '立直を宣言 (1000点供託)'}
              >
                <span className="text-xs font-black leading-none">
                  {isRiichi ? '立直済' : '立直'}
                </span>
                <span
                  className={`text-[9px] font-mono leading-none ${
                    isRiichi ? 'text-neutral-900 font-bold' : 'text-neutral-400'
                  }`}
                >
                  1000
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
