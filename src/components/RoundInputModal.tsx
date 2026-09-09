/**
 * 局結果入力モーダルコンポーネント
 * LocalStorage即時下書き保存 ＋ 二重送信物理防止（disabled）
 */

'use client';

import React, { useEffect, useState } from 'react';
import { calculateScore } from '@/lib/mahjong/calc';
import { getDealer, getRoundName } from '@/lib/mahjong/rules';
import { RoundRecord, RuleConfig, WinType } from '@/types/mahjong';
import { RoundInputDraft } from '@/hooks/useGame';

interface RoundInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: string[];
  roundIdx: number;
  honba: number;
  riichiSticks: number;
  ruleConfig: RuleConfig;
  draft: RoundInputDraft;
  updateDraft: (updater: Partial<RoundInputDraft>) => void;
  onCommit: (record: RoundRecord, han?: number, fu?: number) => Promise<boolean>;
  initialWinType: WinType;
}

const HAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 13];
const FU_OPTIONS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

export const RoundInputModal: React.FC<RoundInputModalProps> = ({
  isOpen,
  onClose,
  players,
  roundIdx,
  honba,
  riichiSticks,
  ruleConfig,
  draft,
  updateDraft,
  onCommit,
  initialWinType,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const currentDealer = getDealer(players, roundIdx);
  const roundName = getRoundName(roundIdx);

  useEffect(() => {
    if (isOpen) {
      updateDraft({ winType: initialWinType });
    }
  }, [isOpen, initialWinType, updateDraft]);

  if (!isOpen) return null;

  const { winType, winner, loser, han, fu, tenpai, chomboPlayer } = draft;

  // 点数プレビュー計算
  let previewTotal = 0;
  if (winType === 'ron' || winType === 'tsumo') {
    const isDealer = winner === currentDealer;
    const isTsumo = winType === 'tsumo';
    const scoreRes = calculateScore(han, fu, isDealer, isTsumo);
    const honbaPt = (ruleConfig.detail?.honba_pt ?? 300) * honba;
    const riichiPt = (ruleConfig.detail?.riichi_pt ?? 1000) * riichiSticks;
    previewTotal = scoreRes.total + honbaPt + riichiPt;
  }

  // 確定ボタン活性判定
  const canSubmit = (() => {
    if (submitting) return false;
    if (winType === 'ron') {
      return Boolean(winner && loser && winner !== loser && han && fu);
    }
    if (winType === 'tsumo') {
      return Boolean(winner && han && fu);
    }
    if (winType === 'ryukyoku') {
      return true; // テンパイ0人〜4人いずれも可
    }
    if (winType === 'chombo') {
      return Boolean(chomboPlayer);
    }
    return false;
  })();

  // 確定処理
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      let record: RoundRecord;
      const isDealer = winner === currentDealer;
      const isTsumo = winType === 'tsumo';
      const baseScore =
        winType === 'ron' || winType === 'tsumo'
          ? calculateScore(han, fu, isDealer, isTsumo).total
          : 0;

      if (winType === 'ron' || winType === 'tsumo') {
        record = {
          kyoku_name: roundName,
          winner,
          loser: winType === 'ron' ? loser : null,
          win_type: winType,
          score: baseScore,
          riichi: [],
          tenpai: [],
        };
      } else if (winType === 'ryukyoku') {
        record = {
          kyoku_name: roundName,
          winner: null,
          loser: null,
          win_type: 'ryukyoku',
          score: 0,
          riichi: [],
          tenpai,
        };
      } else {
        // chombo
        record = {
          kyoku_name: roundName,
          winner: chomboPlayer,
          loser: null,
          win_type: 'chombo',
          score: 0,
          riichi: [],
        };
      }

      const ok = await onCommit(record, han, fu);
      if (ok) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <span className="text-base font-bold text-white">
              {winType === 'ron' && 'ロン和了 入力'}
              {winType === 'tsumo' && 'ツモ和了 入力'}
              {winType === 'ryukyoku' && '流局 入力'}
              {winType === 'chombo' && 'チョンボ 入力'}
            </span>
            <span className="text-xs text-neutral-400 ml-2">
              {roundName} {honba}本場
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ロン / ツモ 入力フォーム */}
        {(winType === 'ron' || winType === 'tsumo') && (
          <div className="flex flex-col gap-3.5">
            {/* 和了者選択 */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                和了者 (アガリ)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {players.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateDraft({ winner: p })}
                    className={`h-11 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      winner === p
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 放銃者選択 (ロン時のみ) */}
            {winType === 'ron' && (
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                  放銃者 (ロンされた人)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {players.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={p === winner}
                      onClick={() => updateDraft({ loser: p })}
                      className={`h-11 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                        p === winner
                          ? 'opacity-30 cursor-not-allowed bg-neutral-900 text-neutral-600'
                          : loser === p
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 翻数選択 */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                翻数 (Han)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {HAN_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => updateDraft({ han: h })}
                    className={`h-10 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      han === h
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {h >= 13 ? '役満' : `${h}翻`}
                  </button>
                ))}
              </div>
            </div>

            {/* 符数選択 */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                符数 (Fu)
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {FU_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => updateDraft({ fu: f })}
                    className={`h-10 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      fu === f
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {f}符
                  </button>
                ))}
              </div>
            </div>

            {/* 獲得点数プレビュー */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">
                受け取り総点 (供託・本場含む)
              </span>
              <span className="text-xl font-black text-amber-300">
                {previewTotal.toLocaleString()} 点
              </span>
            </div>
          </div>
        )}

        {/* 流局 入力フォーム */}
        {winType === 'ryukyoku' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-neutral-300">
              テンパイしている人を選択 (複数選択可)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => {
                const isTenpai = tenpai.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const next = isTenpai
                        ? tenpai.filter((t) => t !== p)
                        : [...tenpai, p];
                      updateDraft({ tenpai: next });
                    }}
                    className={`h-14 rounded-xl text-sm font-bold transition-all flex items-center justify-center border ${
                      isTenpai
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-md'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {p} {isTenpai ? '(聴牌)' : '(不聴)'}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500 text-center mt-1">
              ※ テンパイ人数に応じて場3000点が自動分配されます
            </p>
          </div>
        )}

        {/* チョンボ 入力フォーム */}
        {winType === 'chombo' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-neutral-300">
              チョンボをした人を選択
            </label>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateDraft({ chomboPlayer: p })}
                  className={`h-14 rounded-xl text-sm font-bold transition-all flex items-center justify-center border ${
                    chomboPlayer === p
                      ? 'bg-purple-600/40 border-purple-500 text-purple-200 shadow-md'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-500 text-center mt-1">
              ※ ルール設定（満貫払い）に従って点数が精算されます
            </p>
          </div>
        )}

        {/* 確定アクションボタン (二重押し物理遮断) */}
        <div className="pt-2 border-t border-neutral-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-sm transition-colors"
          >
            キャンセル
          </button>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`flex-2 h-12 rounded-xl font-black text-base shadow-lg transition-all flex items-center justify-center ${
              canSubmit
                ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white'
                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            }`}
          >
            {submitting ? '確定送信中...' : '局結果を確定'}
          </button>
        </div>
      </div>
    </div>
  );
};
