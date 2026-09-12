/**
 * 点数選択ステップ (Step 2: 3x4完全スクロールレスグリッド ＋ 倍満〜/その他ポップアップ)
 * 単一和了およびダブロン（複数和了者）の双方に対応
 */

'use client';

import React, { useState } from 'react';
import { WinType, MultiWinnerDraft } from '@/types/mahjong';
import { calculateScore } from '@/lib/mahjong/calc';
import {
  KO_RON_PRESETS_3X4,
  OYA_RON_PRESETS_3X4,
  KO_TSUMO_PRESETS_3X4,
  OYA_TSUMO_PRESETS_3X4,
  HIGH_SCORE_PRESETS,
  ScorePresetItem,
  HAN_OPTIONS,
  FU_OPTIONS,
} from '@/lib/mahjong/presets';

interface ScoreStepProps {
  winner: string | null;
  winType: WinType;
  currentDealer: string;
  multiWinners: MultiWinnerDraft[];
  onSelectSingleScore: (p: { pts: number; han: number; fu: number }) => void;
  onUpdateMultiWinnerScore: (winner: string, pts: number, han: number, fu: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export const ScoreStep: React.FC<ScoreStepProps> = ({
  winner,
  winType,
  currentDealer,
  multiWinners,
  onSelectSingleScore,
  onUpdateMultiWinnerScore,
  onBack,
  onNext,
}) => {
  // ダブロン時のアクティブ和了者インデックス
  const [activeMultiIdx, setActiveMultiIdx] = useState(0);
  // 「倍満〜 / その他」展開モーダル
  const [showHighOrCustomModal, setShowHighOrCustomModal] = useState(false);
  const [customHan, setCustomHan] = useState(1);
  const [customFu, setCustomFu] = useState(30);

  const isMulti = winType === 'multi_ron';
  const currentTargetWinner = isMulti
    ? multiWinners[activeMultiIdx]?.winner || ''
    : winner || '';

  const isTargetDealer = currentTargetWinner === currentDealer;

  // 3x4プリセットの取得 (11件)
  const presets3x4: ScorePresetItem[] = (() => {
    if (winType === 'tsumo') {
      return isTargetDealer ? OYA_TSUMO_PRESETS_3X4 : KO_TSUMO_PRESETS_3X4;
    }
    return isTargetDealer ? OYA_RON_PRESETS_3X4 : KO_RON_PRESETS_3X4;
  })();

  // 高打点（倍満〜）プリセットの取得
  const highPresets = (() => {
    if (winType === 'tsumo') {
      return isTargetDealer ? HIGH_SCORE_PRESETS.oya_tsumo : HIGH_SCORE_PRESETS.ko_tsumo;
    }
    return isTargetDealer ? HIGH_SCORE_PRESETS.oya_ron : HIGH_SCORE_PRESETS.ko_ron;
  })();

  // プリセット選択時のハンドラ
  const handleSelectPreset = (p: ScorePresetItem) => {
    if (isMulti) {
      onUpdateMultiWinnerScore(currentTargetWinner, p.pts, p.han, p.fu);
      // 次の和了者が未設定なら自動的に次の和了者タブへ
      if (activeMultiIdx < multiWinners.length - 1) {
        setActiveMultiIdx((prev) => prev + 1);
      }
    } else {
      onSelectSingleScore(p);
      onNext();
    }
  };

  // 高打点・手動計算適用ハンドラ
  const handleApplyCustom = (pts: number, han: number, fu: number) => {
    if (isMulti) {
      onUpdateMultiWinnerScore(currentTargetWinner, pts, han, fu);
      setShowHighOrCustomModal(false);
      if (activeMultiIdx < multiWinners.length - 1) {
        setActiveMultiIdx((prev) => prev + 1);
      }
    } else {
      onSelectSingleScore({ pts, han, fu });
      setShowHighOrCustomModal(false);
      onNext();
    }
  };

  // ダブロン時に全員の点数が設定済みか確認
  const allMultiReady =
    isMulti &&
    multiWinners.length >= 2 &&
    multiWinners.every((w) => w.score > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div>
          <span className="text-xs font-black text-neutral-200">
            Step 2/3: 点数を選択
          </span>
          <span className="text-xs text-neutral-400 ml-1.5 font-bold">
            ({currentTargetWinner} {isTargetDealer ? '親' : '子'})
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-400 hover:text-white underline font-bold"
        >
          関係者を変更
        </button>
      </div>

      {/* ─── ダブロン時の和了者切替タブ ─── */}
      {isMulti && (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-2 gap-1.5">
            {multiWinners.map((mw, idx) => {
              const isSelected = idx === activeMultiIdx;
              const isOya = mw.winner === currentDealer;
              return (
                <button
                  key={mw.winner}
                  type="button"
                  onClick={() => setActiveMultiIdx(idx)}
                  className={`h-11 rounded-xl font-black text-xs px-2.5 flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'bg-amber-600/30 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-neutral-850 border-neutral-750 text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{mw.winner}</span>
                    {isOya && <span className="text-[10px] text-amber-400 font-bold">(親)</span>}
                  </div>
                  <span className="font-mono text-xs">
                    {mw.score > 0 ? `${mw.score.toLocaleString()}点` : '未選択'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 3x4 グリッド (11枠 + その他1枠 = 計12枠) ─── */}
      <div className="grid grid-cols-3 gap-2">
        {presets3x4.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handleSelectPreset(preset)}
            className="h-14 rounded-xl bg-neutral-850 hover:bg-neutral-800 active:bg-amber-500 active:text-black border border-neutral-700/80 text-neutral-100 font-black text-xs flex flex-col items-center justify-center transition-all touch-manipulation shadow-xs"
          >
            <span className="text-sm font-black font-mono">
              {preset.label.split(' ')[0]}
            </span>
            <span className="text-[10px] font-medium text-neutral-400 mt-0.5">
              {preset.label.split(' ')[1] || ''}
            </span>
          </button>
        ))}

        {/* 12番目の枠: 倍満〜 / その他 */}
        <button
          type="button"
          onClick={() => setShowHighOrCustomModal(true)}
          className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-600 text-amber-300 font-black text-xs flex flex-col items-center justify-center transition-all touch-manipulation shadow-xs"
        >
          <span className="text-xs font-black">倍満〜 / その他</span>
          <span className="text-[10px] font-normal text-neutral-400 mt-0.5">
            翻・符手動計算
          </span>
        </button>
      </div>

      {/* ─── ダブロン時: 全員選択完了後の次へボタン ─── */}
      {isMulti && (
        <div className="pt-2">
          <button
            type="button"
            disabled={!allMultiReady}
            onClick={onNext}
            className={`w-full h-12 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
              allMultiReady
                ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black'
                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-750'
            }`}
          >
            確認画面へ進む &rarr;
          </button>
        </div>
      )}

      {/* ─── モーダル: 倍満以上 ＆ 翻・符手動計算 ─── */}
      {showHighOrCustomModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-750 rounded-2xl p-4 flex flex-col gap-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-sm font-black text-white">
                高打点・翻符手動計算 ({currentTargetWinner})
              </span>
              <button
                type="button"
                onClick={() => setShowHighOrCustomModal(false)}
                className="text-neutral-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* 高打点クイック選択 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-neutral-400">
                倍満以上の役
              </span>
              <div className="grid grid-cols-3 gap-2">
                {highPresets.map((hp) => (
                  <button
                    key={hp.label}
                    type="button"
                    onClick={() => handleApplyCustom(hp.pts, hp.han, hp.fu)}
                    className="h-13 rounded-xl bg-neutral-850 hover:bg-amber-600 hover:text-white border border-neutral-700 text-neutral-200 font-black text-xs flex flex-col items-center justify-center transition-all"
                  >
                    <span className="text-xs font-bold">{hp.label.split(' ')[1] || hp.label}</span>
                    <span className="text-[10px] font-mono opacity-80">{hp.pts.toLocaleString()}点</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 翻・符手動セレクタ */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-400">
                翻と符を手動指定
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">
                    翻 (Han)
                  </label>
                  <select
                    value={customHan}
                    onChange={(e) => setCustomHan(Number(e.target.value))}
                    className="w-full h-10 bg-neutral-950 border border-neutral-700 rounded-lg px-2 text-xs font-bold text-white"
                  >
                    {HAN_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h >= 13 ? '13翻 (役満)' : `${h}翻`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-1">
                    符 (Fu)
                  </label>
                  <select
                    value={customFu}
                    onChange={(e) => setCustomFu(Number(e.target.value))}
                    className="w-full h-10 bg-neutral-950 border border-neutral-700 rounded-lg px-2 text-xs font-bold text-white"
                  >
                    {FU_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}符
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* リアルタイム点数プレビュー表示 */}
              {(() => {
                const isTsumo = winType === 'tsumo';
                const customScore = calculateScore(customHan, customFu, isTargetDealer, isTsumo);
                const customRankLabel = (() => {
                  if (customHan >= 13) return '役満';
                  if (customHan >= 11) return '三倍満';
                  if (customHan >= 8) return '倍満';
                  if (customHan >= 6) return '跳満';
                  if (
                    customHan >= 5 ||
                    (customHan === 4 && customFu >= 40) ||
                    (customHan === 3 && customFu >= 70) ||
                    customFu * Math.pow(2, 2 + customHan) >= 2000
                  ) {
                    return '満貫';
                  }
                  return null;
                })();

                const buttonLabel = isTsumo
                  ? isTargetDealer
                    ? `${customScore.total.toLocaleString()}点 (${customScore.nonDealerPay.toLocaleString()}オール) を適用`
                    : `${customScore.total.toLocaleString()}点 (${customScore.nonDealerPay.toLocaleString()}/${customScore.dealerPay.toLocaleString()}) を適用`
                  : `${customScore.total.toLocaleString()}点 を適用`;

                return (
                  <>
                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col gap-1 shadow-inner">
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400">
                        <span>
                          計算結果 ({isTargetDealer ? '親' : '子'}・{isTsumo ? 'ツモ' : 'ロン'}
                          {customRankLabel ? ` / ${customRankLabel}` : ''})
                        </span>
                        <span className="text-neutral-500 font-mono">
                          {customHan}翻 {customFu}符
                        </span>
                      </div>

                      {isTsumo ? (
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="text-base font-black text-amber-300 font-mono">
                            {isTargetDealer
                              ? `${customScore.nonDealerPay.toLocaleString()} オール`
                              : `${customScore.nonDealerPay.toLocaleString()} / ${customScore.dealerPay.toLocaleString()}`}
                          </span>
                          <span className="text-xs font-bold text-neutral-300">
                            合計 <span className="font-mono text-white text-sm font-black">{customScore.total.toLocaleString()}</span> 点
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="text-2xl font-black text-amber-300 font-mono tracking-tight">
                            {customScore.total.toLocaleString()}
                            <span className="text-xs font-bold text-neutral-300 ml-1">点</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyCustom(customScore.total, customHan, customFu)}
                      className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-300 text-black font-black text-xs transition-all shadow-md flex items-center justify-center gap-1 mt-0.5"
                    >
                      {buttonLabel}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
