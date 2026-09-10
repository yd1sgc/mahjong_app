/**
 * 局結果入力モーダルコンポーネント
 * mahjong_personal 準拠：ステップ式ウィザード（誰が和了 → ロン/ツモ → 点数プリセット → 放銃者）
 * LocalStorage即時下書き保存 ＋ 二重送信物理防止（disabled）
 */

'use client';

import React, { useEffect, useState } from 'react';
import { calculateScore } from '@/lib/mahjong/calc';
import { getDealer, getRoundName } from '@/lib/mahjong/rules';
import { RoundRecord, RuleConfig, WinType } from '@/types/mahjong';
import { RoundInputDraft } from '@/hooks/useGame';
import {
  KO_RON_PRESETS,
  OYA_RON_PRESETS,
  KO_TSUMO_PRESETS,
  OYA_TSUMO_PRESETS,
  HAN_OPTIONS,
  FU_OPTIONS,
} from '@/lib/mahjong/presets';

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
  const [step, setStep] = useState(0); // 0: 和了者, 1: ロン/ツモ, 2: 点数, 3: 放銃者, 4: 確認
  const [showCustomCalc, setShowCustomCalc] = useState(false);
  const [customHan, setCustomHan] = useState(draft.han || 1);
  const [customFu, setCustomFu] = useState(draft.fu || 30);

  const currentDealer = getDealer(players, roundIdx);
  const roundName = getRoundName(roundIdx);

  useEffect(() => {
    if (isOpen) {
      updateDraft({ winType: initialWinType });
      // 流局やチョンボの場合は即座に入力可能
      if (initialWinType === 'ryukyoku' || initialWinType === 'chombo') {
        setStep(0);
      } else {
        // 和了開始
        setStep(0);
      }
    }
  }, [isOpen, initialWinType, updateDraft]);

  if (!isOpen) return null;

  const { winType, winner, loser, han, fu, tenpai, chomboPlayer } = draft;
  const isDealerWinner = winner === currentDealer;

  // 点数プレビュー計算
  let baseScore = 0;
  if (winType === 'ron' || winType === 'tsumo') {
    const isTsumo = winType === 'tsumo';
    const scoreRes = calculateScore(han || 1, fu || 30, isDealerWinner, isTsumo);
    baseScore = scoreRes.total;
  }
  const honbaPt = (ruleConfig.detail?.honba_pt ?? 300) * honba;
  const riichiPt = (ruleConfig.detail?.riichi_pt ?? 1000) * riichiSticks;
  const totalReceive = baseScore + honbaPt + riichiPt;

  // 確定コミット処理
  const handleFinalCommit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      let record: RoundRecord;

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

  // プリセット点数選択時の処理
  const handleSelectPreset = (p: { pts: number; han: number; fu: number }) => {
    updateDraft({ han: p.han, fu: p.fu });
    if (winType === 'tsumo') {
      // ツモの場合は放銃者選択がないので確認画面（Step 4）へ
      setStep(4);
    } else {
      // ロンの場合は放銃者選択（Step 3）へ
      setStep(3);
    }
  };

  // 翻符手動計算適用
  const handleApplyCustomCalc = () => {
    updateDraft({ han: customHan, fu: customFu });
    if (winType === 'tsumo') {
      setStep(4);
    } else {
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 max-h-[92dvh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">
              {winType === 'ron' || winType === 'tsumo'
                ? '和了入力'
                : winType === 'ryukyoku'
                ? '流局入力'
                : 'チョンボ入力'}
            </span>
            <span className="text-xs font-bold text-neutral-400">
              {roundName} {honba}本場 (供託{riichiSticks}本)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ─── 和了フロー ─── */}
        {(winType === 'ron' || winType === 'tsumo') && (
          <div className="flex flex-col gap-3">
            {/* Step 0: 誰が和了？ */}
            {step === 0 && (
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
                        onClick={() => {
                          updateDraft({ winner: p });
                          setStep(1);
                        }}
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
            )}

            {/* Step 1: ロン？ ツモ？ */}
            {step === 1 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-neutral-200">
                    Step 2/3: 和了方式を選択 ({winner})
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="text-xs text-neutral-400 hover:text-white underline font-bold"
                  >
                    和了者を変更
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft({ winType: 'ron' });
                      setStep(2);
                    }}
                    className="h-20 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] border border-rose-500/50 text-white font-black text-xl shadow-md flex items-center justify-center touch-manipulation"
                  >
                    ロン和了
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft({ winType: 'tsumo' });
                      setStep(2);
                    }}
                    className="h-20 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] border border-amber-500/50 text-white font-black text-xl shadow-md flex items-center justify-center touch-manipulation"
                  >
                    ツモ和了
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: 点数は？（主要打点ボタングリッド ＋ 翻符アコーディオン） */}
            {step === 2 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-neutral-200">
                    Step 3/3: 点数を選択 ({winner} / {winType === 'ron' ? 'ロン' : 'ツモ'})
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-neutral-400 hover:text-white underline font-bold"
                  >
                    方式を変更
                  </button>
                </div>

                {/* プリセットボタン一覧 */}
                <div className="grid grid-cols-3 gap-1.5 max-h-[48dvh] overflow-y-auto p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                  {(winType === 'ron'
                    ? isDealerWinner
                      ? OYA_RON_PRESETS
                      : KO_RON_PRESETS
                    : isDealerWinner
                    ? OYA_TSUMO_PRESETS
                    : KO_TSUMO_PRESETS
                  ).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="min-h-[46px] p-1.5 rounded-lg bg-neutral-850 hover:bg-neutral-800 active:bg-amber-500 active:text-black border border-neutral-700/80 text-neutral-100 font-black text-xs flex flex-col items-center justify-center transition-all touch-manipulation"
                    >
                      <span className="leading-tight">{preset.label.split(' ')[0]}</span>
                      <span className="text-[10px] font-normal text-neutral-400 mt-0.5">
                        {preset.label.split(' ')[1] || ''}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 翻・符 手動計算アコーディオン */}
                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60">
                  <button
                    type="button"
                    onClick={() => setShowCustomCalc((prev) => !prev)}
                    className="w-full px-3 py-2 text-xs font-bold text-neutral-400 hover:text-white flex items-center justify-between"
                  >
                    <span>翻・符から手動計算する</span>
                    <span>{showCustomCalc ? '▲ 閉じる' : '▼ 開く'}</span>
                  </button>

                  {showCustomCalc && (
                    <div className="p-3 border-t border-neutral-800 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                            翻 (Han)
                          </label>
                          <select
                            value={customHan}
                            onChange={(e) => setCustomHan(Number(e.target.value))}
                            className="w-full h-10 bg-neutral-900 border border-neutral-700 rounded-lg px-2 text-xs font-bold text-white"
                          >
                            {HAN_OPTIONS.map((h) => (
                              <option key={h} value={h}>
                                {h >= 13 ? '13翻 (役満)' : `${h}翻`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                            符 (Fu)
                          </label>
                          <select
                            value={customFu}
                            onChange={(e) => setCustomFu(Number(e.target.value))}
                            className="w-full h-10 bg-neutral-900 border border-neutral-700 rounded-lg px-2 text-xs font-bold text-white"
                          >
                            {FU_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {f}符
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyCustomCalc}
                        className="w-full h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 font-bold text-xs text-white border border-neutral-700 transition-colors"
                      >
                        この翻・符で決定
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: 放銃者は？（ロン時のみ） */}
            {step === 3 && winType === 'ron' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-neutral-200">
                    放銃者を選択 (ロンされた人)
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs text-neutral-400 hover:text-white underline font-bold"
                  >
                    点数を変更
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {players
                    .filter((p) => p !== winner)
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          updateDraft({ loser: p });
                          setStep(4);
                        }}
                        className="h-16 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-700 text-white font-black text-base flex items-center justify-center touch-manipulation"
                      >
                        {p}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Step 4: 最終確認 ＆ コミット */}
            {step === 4 && (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-2">
                  <div className="text-xs font-bold text-neutral-400">和了内容の確認</div>
                  <div className="flex items-center justify-between text-base font-black text-white">
                    <span>
                      {winner} {winType === 'ron' ? `(放銃: ${loser})` : '(ツモ)'}
                    </span>
                    <span className="text-amber-300">
                      素点 {baseScore.toLocaleString()}点
                    </span>
                  </div>
                  {(honba > 0 || riichiSticks > 0) && (
                    <div className="text-xs text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-850">
                      <span>本場・供託加算</span>
                      <span className="text-neutral-200 font-bold">
                        +{ (honbaPt + riichiPt).toLocaleString() }点
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-lg font-black text-white">
                    <span>受取総点</span>
                    <span className="text-xl text-cyan-400 font-black">
                      {totalReceive.toLocaleString()} 点
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(winType === 'ron' ? 3 : 2)}
                    className="flex-1 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs transition-colors"
                  >
                    やり直す
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleFinalCommit}
                    className="flex-2 h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
                  >
                    {submitting ? '記録中...' : '和了を確定して次局へ'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── 流局フロー ─── */}
        {winType === 'ryukyoku' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-black text-neutral-200">
              テンパイしているプレイヤーを選択 (複数可)
            </p>
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
                    className={`h-16 rounded-xl font-black text-base flex items-center justify-center transition-all border ${
                      isTenpai
                        ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-sm'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <span>{p}</span>
                    <span className="text-xs ml-1.5 opacity-80">
                      ({isTenpai ? '聴牌' : '不聴'})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold text-neutral-400 flex items-center justify-between">
              <span>ノーテン罰符精算</span>
              <span className="text-neutral-200">
                {tenpai.length === 0 || tenpai.length === 4
                  ? '受渡なし (場0点)'
                  : tenpai.length === 1
                  ? 'テンパイ +3,000点 / ノーテン -1,000点'
                  : tenpai.length === 2
                  ? 'テンパイ +1,500点 / ノーテン -1,500点'
                  : 'テンパイ +1,000点 / ノーテン -3,000点'}
              </span>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalCommit}
              className="w-full h-12 rounded-xl bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
            >
              {submitting ? '記録中...' : '流局を確定して次局へ'}
            </button>
          </div>
        )}

        {/* ─── チョンボフロー ─── */}
        {winType === 'chombo' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-black text-neutral-200">
              チョンボをしたプレイヤーを選択
            </p>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => {
                const isSelected = chomboPlayer === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateDraft({ chomboPlayer: p })}
                    className={`h-16 rounded-xl font-black text-base flex items-center justify-center transition-all border ${
                      isSelected
                        ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-sm'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold text-neutral-400 flex items-center justify-between">
              <span>チョンボ精算</span>
              <span className="text-neutral-200">
                満貫払い（親: 子3名へ各4000点 / 子: 親へ4000点・子へ各2000点）
              </span>
            </div>

            <button
              type="button"
              disabled={!chomboPlayer || submitting}
              onClick={handleFinalCommit}
              className={`w-full h-12 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
                chomboPlayer
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
              }`}
            >
              {submitting ? '記録中...' : 'チョンボを確定（同局やり直し）'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
