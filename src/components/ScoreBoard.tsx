/**
 * スコアボードUIコンポーネント（見た目と描画のみ）
 * 麻雀の計算やAPI通信コードは一切含めない
 */

'use client';

import React from 'react';
import { GameStateSnapshot } from '@/types/mahjong';
import { getDealer, getRoundName } from '@/lib/mahjong/rules';

interface ScoreBoardProps {
  players: string[];
  gameState: GameStateSnapshot | null;
  onRiichiClick?: (player: string) => void;
  isRecorder?: boolean;
}

const SEAT_NAMES = ['東', '南', '西', '北'];

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  players,
  gameState,
  onRiichiClick,
  isRecorder = false,
}) => {
  if (!gameState || players.length < 4) {
    return (
      <div className="flex items-center justify-center p-8 text-neutral-400">
        対局データを読み込み中...
      </div>
    );
  }

  const currentDealer = getDealer(players, gameState.roundIdx);
  const roundName = getRoundName(gameState.roundIdx);

  // 順位・点差計算用のソート
  const sortedPlayers = [...players].sort(
    (a, b) => (gameState.scores[b] ?? 0) - (gameState.scores[a] ?? 0)
  );
  const topScore = gameState.scores[sortedPlayers[0]] ?? 0;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* 局情報ヘッダー */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-white tracking-wide">
            {roundName}
          </span>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
            {gameState.honba} 本場
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span>供託: <strong>{gameState.riichiStick}</strong> 本 ({gameState.riichiStick * 1000}点)</span>
        </div>
      </div>

      {/* 4名スコアボード (2x2 グリッド) */}
      <div className="grid grid-cols-2 gap-2.5">
        {players.map((player, idx) => {
          const score = gameState.scores[player] ?? 0;
          const isDealer = player === currentDealer;
          const isRiichi = gameState.riichiDeclared.includes(player);
          const rank = sortedPlayers.indexOf(player) + 1;
          const diffFromTop = score - topScore;

          return (
            <div
              key={player}
              className={`relative flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                isDealer
                  ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-neutral-900 border-neutral-800'
              }`}
            >
              {/* プレイヤー情報行 */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded bg-neutral-800 text-neutral-300">
                    {SEAT_NAMES[idx]}
                  </span>
                  <span className="font-bold text-sm text-white truncate max-w-[90px]">
                    {player}
                  </span>
                  {isDealer && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600/80 text-white leading-none">
                      親
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-800/80 px-1.5 py-0.5 rounded">
                  {rank}位
                </span>
              </div>

              {/* 点数表示 */}
              <div className="flex items-baseline justify-between mt-1">
                <span
                  className={`text-2xl font-black tracking-tight ${
                    score < 0
                      ? 'text-red-400'
                      : isDealer
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  {score.toLocaleString()}
                </span>
                {rank > 1 && (
                  <span className="text-[11px] font-medium text-neutral-400">
                    {diffFromTop.toLocaleString()}
                  </span>
                )}
              </div>

              {/* リーチ宣言状態・ボタン */}
              <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between min-h-[32px]">
                {isRiichi ? (
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    リーチ宣言中
                  </span>
                ) : isRecorder && onRiichiClick ? (
                  <button
                    type="button"
                    onClick={() => onRiichiClick(player)}
                    className="w-full text-xs font-semibold py-1 px-2.5 rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-300 hover:text-white transition-colors border border-neutral-700/60"
                  >
                    立直 (1000点)
                  </button>
                ) : (
                  <span className="text-[11px] text-neutral-500">ダマテン</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
