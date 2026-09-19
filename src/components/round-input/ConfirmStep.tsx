/**
 * 最終確認 ＆ コミットステップ (Step 2: ロン・ツモ・ダブロン対応)
 */

'use client';

import React from 'react';
import { WinType, MultiWinnerDraft } from '@/types/mahjong';
import { calculateScore } from '@/lib/mahjong/calc';

interface ConfirmStepProps {
  winner: string | null;
  loser: string | null;
  winType: WinType;
  baseScore: number;
  honba: number;
  riichiSticks: number;
  honbaPt: number;
  riichiPt: number;
  totalReceive: number;
  multiWinners: MultiWinnerDraft[];
  closestWinner: string;
  submitting: boolean;
  onCommit: () => void;
  onBack: () => void;
  players?: string[];
  currentDealer?: string;
  han?: number;
  fu?: number;
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({
  winner,
  loser,
  winType,
  baseScore,
  honba,
  riichiSticks,
  honbaPt,
  riichiPt,
  totalReceive,
  multiWinners,
  closestWinner,
  submitting,
  onCommit,
  onBack,
  players = [],
  currentDealer,
  han = 1,
  fu = 30,
}) => {
  const isMulti = winType === 'multi_ron';
  const isTsumo = winType === 'tsumo';
  const isWinnerDealer = winner === currentDealer;

  // ツモ計算（親/子の支払額）
  const scoreCalc = calculateScore(han, fu, isWinnerDealer, isTsumo);
  const honbaPerPlayer = honba > 0 ? Math.floor(honbaPt / 3) : 0;

  // ダブロン時の放銃者総支払額
  const multiTotalPayment = isMulti
    ? multiWinners.reduce((sum, w) => sum + w.score + honbaPt, 0)
    : 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* ─── CASE 1: 通常ロン和了 ─── */}
      {winType === 'ron' && (
        <div className="flex flex-col gap-2">
          {/* 放銃者 ➔ 和了者 関係カード */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-500">放銃者</span>
              <span className="text-sm font-black text-neutral-200">{loser}</span>
            </div>
            <div className="flex flex-col items-center px-2">
              <span className="text-[9px] font-mono text-neutral-500 font-bold">RON</span>
              <svg className="w-6 h-3.5 text-neutral-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-neutral-500">和了者</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white">{winner}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    isWinnerDealer ? 'bg-rose-600 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {isWinnerDealer ? '親' : '子'}
                </span>
              </div>
            </div>
          </div>

          {/* 明細カード（レシート型） */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-850">
              <span className="text-neutral-400 font-bold">素点 ({han}翻{fu}符)</span>
              <span className="font-mono text-white font-black text-sm">{baseScore}</span>
            </div>
            {honba > 0 && (
              <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-850">
                <span className="text-neutral-400 font-bold">本場 ({honba}本場)</span>
                <span className="font-mono text-neutral-200 font-bold">+{honbaPt}</span>
              </div>
            )}
            {riichiSticks > 0 && (
              <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-850">
                <span className="text-neutral-400 font-bold">立直供託 ({riichiSticks}本)</span>
                <span className="font-mono text-neutral-200 font-bold">+{riichiPt}</span>
              </div>
            )}

            {/* 収支対比 */}
            <div className="pt-1 flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-black text-white">{winner} の受取</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black font-mono text-amber-300 tracking-tight">
                    {totalReceive}
                  </span>
                  <span className="text-xs font-bold text-amber-300/80">点</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between text-neutral-400 text-xs pt-1 border-t border-neutral-900 font-mono">
                <span className="text-[11px] font-bold text-neutral-500">{loser} の支払 (供託除く)</span>
                <span className="font-bold text-neutral-300">-( {baseScore + honbaPt} 点 )</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CASE 2: ツモ和了 ─── */}
      {winType === 'tsumo' && (
        <div className="flex flex-col gap-2">
          {/* 和了者カード */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white">{winner}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                  isWinnerDealer ? 'bg-rose-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {isWinnerDealer ? '親' : '子'}
              </span>
              <span className="text-xs font-bold text-neutral-400">ツモ</span>
            </div>
            <span className="text-xs font-mono font-bold text-neutral-300">
              {han}翻{fu}符
            </span>
          </div>

          {/* 支払内訳明細 */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col gap-1.5">
            <div className="text-[10px] font-bold text-neutral-500 mb-0.5">
              各自の支払 {honba > 0 ? `(${honba}本場 各+${honbaPerPlayer}点加算済)` : ''}
            </div>

            {/* プレイヤーごとの支払い表示 */}
            {players
              .filter((p) => p !== winner)
              .map((p) => {
                const isPDealer = p === currentDealer;
                const basePay = isPDealer ? scoreCalc.dealerPay : scoreCalc.nonDealerPay;
                const totalPay = basePay + honbaPerPlayer;

                return (
                  <div
                    key={p}
                    className="flex items-center justify-between text-xs py-0.5 border-b border-neutral-850"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-neutral-300">{p}</span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                          isPDealer ? 'bg-rose-600 text-white' : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {isPDealer ? '親' : '子'}
                      </span>
                    </div>
                    <span className="font-mono text-neutral-200 font-bold">
                      {totalPay}{' '}
                      {honba > 0 && (
                        <span className="text-[10px] text-neutral-500 font-normal">
                          ({basePay}+{honbaPerPlayer})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

            {/* 立直供託 */}
            {riichiSticks > 0 && (
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono pt-0.5">
                <span>立直供託 ({riichiSticks}本)</span>
                <span className="font-bold text-neutral-200">+{riichiPt}点</span>
              </div>
            )}

            {/* 受取総点 */}
            <div className="flex items-baseline justify-between pt-1 border-t border-neutral-800">
              <span className="text-xs font-black text-white">受取総点</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-amber-300 tracking-tight">
                  {totalReceive}
                </span>
                <span className="text-xs font-bold text-amber-300/80">点</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CASE 3: ダブロン ─── */}
      {isMulti && (
        <div className="flex flex-col gap-2">
          {/* 放銃者カード */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-500">放銃者</span>
              <span className="text-sm font-black text-white">{loser}</span>
            </div>
            <div className="flex flex-col items-end font-mono">
              <span className="text-[10px] text-neutral-500 font-bold">放銃総支払 (本場込)</span>
              <span className="text-base font-black text-white">-{multiTotalPayment}点</span>
            </div>
          </div>

          {/* 各和了者の受取内訳 */}
          {multiWinners.map((w) => {
            const isClosest = w.winner === closestWinner;
            const myKyotaku = isClosest ? riichiPt : 0;
            const myTotal = w.score + honbaPt + myKyotaku;
            const isWD = w.winner === currentDealer;

            return (
              <div
                key={w.winner}
                className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white">{w.winner}</span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                        isWD ? 'bg-rose-600 text-white' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {isWD ? '親' : '子'}
                    </span>
                    {isClosest && riichiSticks > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                        上家取り
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-base font-black text-amber-300">
                    {myTotal}
                    <span className="text-xs font-normal text-amber-300/80 ml-0.5">点</span>
                  </span>
                </div>
                <div className="text-[10px] font-mono text-neutral-400 pt-1 border-t border-neutral-850">
                  素点 {w.score} + 本場 {honbaPt}
                  {isClosest && riichiPt > 0 ? ` + 供託 ${riichiPt}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 操作ボタン（次局へ確定: 赤色化） ─── */}
      <div className="flex flex-col gap-1.5 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={onCommit}
          className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.99] disabled:opacity-40 text-white font-black text-sm shadow-md transition-all flex items-center justify-center cursor-pointer"
        >
          {submitting ? '記録中...' : '和了を確定して次局へ →'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-1 text-center text-xs font-bold text-neutral-500 hover:text-white transition-colors cursor-pointer"
        >
          ← 点数選択に戻る
        </button>
      </div>
    </div>
  );
};
