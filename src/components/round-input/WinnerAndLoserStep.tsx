/**
 * 和了種別（ロン/ツモ/ダブロン）および関係者（和了者・放銃者）統合選択ステップ
 * 従来の3画面遷移（和了者 -> 方式 -> 放銃者）を1画面に集約し、手数を劇的に削減
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const winnerBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const loserBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [arrowPolygons, setArrowPolygons] = useState<string[]>([]);

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

  const isBothSelected =
    winType === 'ron'
      ? Boolean(winner && loser && winner !== loser)
      : winType === 'multi_ron'
      ? multiWinners.length >= 2 && Boolean(loser)
      : false;

  // 矢印ポリゴンの頂点計算ヘルパー
  const computeArrowPoints = useCallback(
    (wIdx: number, lIdx: number): string | null => {
      if (!containerRef.current) return null;
      const wEl = winnerBtnRefs.current[wIdx];
      const lEl = loserBtnRefs.current[lIdx];
      if (!wEl || !lEl) return null;

      const cRect = containerRef.current.getBoundingClientRect();
      const wRect = wEl.getBoundingClientRect();
      const lRect = lEl.getBoundingClientRect();

      const colW = wIdx % 2; // 0: 左列, 1: 右列
      const colL = lIdx % 2; // 0: 左列, 1: 右列
      const isDiagonal = colW !== colL;

      let startX: number;
      let startY: number;
      let endX: number;
      let endY: number;

      if (isDiagonal) {
        // 対角線: 画面中央寄りの内側エッジ同士を結ぶ
        startX =
          colL === 0
            ? lRect.right - cRect.left - 12
            : lRect.left - cRect.left + 12;
        startY = lRect.top - cRect.top;

        endX =
          colW === 0
            ? wRect.right - cRect.left - 12
            : wRect.left - cRect.left + 12;
        endY = wRect.bottom - cRect.top;
      } else {
        // 縦直線: 列の中央を通る
        startX = lRect.left + lRect.width / 2 - cRect.left;
        startY = lRect.top - cRect.top;
        endX = wRect.left + wRect.width / 2 - cRect.left;
        endY = wRect.bottom - cRect.top;
      }

      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 25) return null;

      const ux = dx / len;
      const uy = dy / len;
      const nx = -dy / len;
      const ny = dx / len;

      // 枠線との隙間（10px〜12px離隔）
      const gapStart = 10;
      const gapEnd = 12;

      const sx = startX + ux * gapStart;
      const sy = startY + uy * gapStart;
      const ex = endX - ux * gapEnd;
      const ey = endY - uy * gapEnd;

      const actualLen = len - gapStart - gapEnd;
      if (actualLen < 15) return null;

      const headLen = Math.min(15, actualLen * 0.45);
      const headWidth = 9;
      const wBase = 3.5;

      const p1x = sx + nx * wBase;
      const p1y = sy + ny * wBase;
      const p2x = sx - nx * wBase;
      const p2y = sy - ny * wBase;

      const neckX = ex - ux * headLen;
      const neckY = ey - uy * headLen;

      const h1x = neckX + nx * headWidth;
      const h1y = neckY + ny * headWidth;
      const h2x = neckX - nx * headWidth;
      const h2y = neckY - ny * headWidth;

      return `${p1x},${p1y} ${p2x},${p2y} ${neckX - nx * wBase},${
        neckY - ny * wBase
      } ${h2x},${h2y} ${ex},${ey} ${h1x},${h1y} ${neckX + nx * wBase},${
        neckY + ny * wBase
      }`;
    },
    []
  );

  // 矢印の描画更新
  const updateArrows = useCallback(() => {
    if (winType === 'tsumo' || !loser) {
      setArrowPolygons([]);
      return;
    }

    const lIdx = players.indexOf(loser);
    if (lIdx === -1) {
      setArrowPolygons([]);
      return;
    }

    const polys: string[] = [];

    if (winType === 'ron' && winner) {
      const wIdx = players.indexOf(winner);
      if (wIdx !== -1 && wIdx !== lIdx) {
        const poly = computeArrowPoints(wIdx, lIdx);
        if (poly) polys.push(poly);
      }
    } else if (winType === 'multi_ron' && multiWinners.length > 0) {
      multiWinners.forEach((mw) => {
        const wIdx = players.indexOf(mw);
        if (wIdx !== -1 && wIdx !== lIdx) {
          const poly = computeArrowPoints(wIdx, lIdx);
          if (poly) polys.push(poly);
        }
      });
    }

    setArrowPolygons(polys);
  }, [winType, winner, loser, multiWinners, players, computeArrowPoints]);

  useEffect(() => {
    updateArrows();
    const handleResize = () => updateArrows();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateArrows]);

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

      {/* ─── グリッドコンテナ（相対配置・SVG矢印重畳） ─── */}
      <div ref={containerRef} className="relative flex flex-col gap-3.5 py-0.5">
        {/* SVG 矢印オーバーレイ */}
        {arrowPolygons.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {arrowPolygons.map((pts, idx) => (
              <polygon key={idx} points={pts} fill="#f43f5e" />
            ))}
          </svg>
        )}

        {/* ─── 和了者選択エリア ─── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-neutral-300">
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

              // スタイル決定
              let btnStyle: string;
              let nameStyle: string;
              let seatStyle: string;
              let dealerStyle: string;

              if (isSelected) {
                if (winType === 'tsumo') {
                  btnStyle =
                    'border-2 border-cyan-400 bg-cyan-600 text-white shadow-lg z-30 scale-[1.02]';
                  nameStyle = 'text-white font-black';
                  seatStyle = 'text-cyan-200';
                  dealerStyle = 'bg-black/30 text-white border border-white/30';
                } else {
                  // ロン / ダブロン: 白ベタ
                  btnStyle =
                    'border-2 border-white bg-white text-black shadow-2xl z-30 scale-[1.02]';
                  nameStyle = 'text-black font-black';
                  seatStyle = 'text-neutral-600';
                  dealerStyle = 'bg-rose-600 text-white shadow-sm';
                }
              } else if (isBothSelected) {
                // 両者選択完了時: 枠線ノイズを消去して文字のみ薄く浮かす
                btnStyle =
                  'border border-transparent bg-transparent opacity-15 z-0';
                nameStyle = 'text-neutral-200 font-bold';
                seatStyle = 'text-neutral-500';
                dealerStyle = 'bg-rose-600 text-white shadow-sm';
              } else {
                btnStyle =
                  'border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 z-10';
                nameStyle = 'text-neutral-200 font-bold';
                seatStyle = 'text-neutral-500';
                dealerStyle = 'bg-rose-600 text-white shadow-sm';
              }

              return (
                <button
                  key={`winner-${p}`}
                  ref={(el) => {
                    winnerBtnRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => {
                    if (winType === 'multi_ron') {
                      onToggleMultiWinner(p);
                    } else {
                      onSelectWinner(p);
                    }
                  }}
                  className={`h-14 rounded-xl flex items-center justify-between px-3 border transition-all touch-manipulation ${btnStyle}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs font-bold w-4 text-center shrink-0 ${seatStyle}`}
                    >
                      {SEAT_NAMES[idx] || ''}
                    </span>
                    <span className={`truncate text-sm ${nameStyle}`}>{p}</span>
                  </div>
                  {isDealer && (
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${dealerStyle}`}
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
            <span className="text-xs font-black text-neutral-300">放銃者</span>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p, idx) => {
                const isSelected = loser === p;
                const isDealer = p === currentDealer;
                const isWinnerSelected =
                  winType === 'multi_ron'
                    ? multiWinners.includes(p)
                    : winner === p;

                let btnStyle: string;
                let nameStyle: string;
                let seatStyle: string;
                let dealerStyle: string;

                if (isSelected) {
                  // 放銃者: 白太枠 ＋ 黒背景
                  btnStyle =
                    'border-2 border-white bg-neutral-950 text-white shadow-2xl z-30 scale-[1.02]';
                  nameStyle = 'text-white font-black';
                  seatStyle = 'text-neutral-300';
                  dealerStyle = 'bg-rose-600 text-white shadow-sm';
                } else if (isWinnerSelected) {
                  btnStyle =
                    'border border-transparent bg-transparent opacity-10 cursor-not-allowed z-0';
                  nameStyle = 'text-neutral-600 font-bold';
                  seatStyle = 'text-neutral-700';
                  dealerStyle = 'bg-rose-600 text-white shadow-sm';
                } else if (isBothSelected) {
                  // 両者選択完了時: 枠線ノイズを消去
                  btnStyle =
                    'border border-transparent bg-transparent opacity-15 z-0';
                  nameStyle = 'text-neutral-200 font-bold';
                  seatStyle = 'text-neutral-500';
                  dealerStyle = 'bg-rose-600 text-white shadow-sm';
                } else {
                  btnStyle =
                    'border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 z-10';
                  nameStyle = 'text-neutral-200 font-bold';
                  seatStyle = 'text-neutral-500';
                  dealerStyle = 'bg-rose-600 text-white shadow-sm';
                }

                return (
                  <button
                    key={`loser-${p}`}
                    ref={(el) => {
                      loserBtnRefs.current[idx] = el;
                    }}
                    type="button"
                    disabled={isWinnerSelected}
                    onClick={() => onSelectLoser(p)}
                    className={`h-14 rounded-xl flex items-center justify-between px-3 border transition-all touch-manipulation ${btnStyle}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs font-bold w-4 text-center shrink-0 ${seatStyle}`}
                      >
                        {SEAT_NAMES[idx] || ''}
                      </span>
                      <span className={`truncate text-sm ${nameStyle}`}>
                        {p}
                      </span>
                    </div>
                    {isDealer && (
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${dealerStyle}`}
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
      </div>

      {/* ─── 次へ進むボタン ─── */}
      <div className="pt-2">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className={`w-full h-13 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
            canProceed
              ? 'bg-white hover:bg-neutral-200 active:scale-[0.99] text-black cursor-pointer'
              : 'bg-neutral-850 text-neutral-600 cursor-not-allowed border border-neutral-800'
          }`}
        >
          点数選択へ進む →
        </button>
      </div>
    </div>
  );
};
