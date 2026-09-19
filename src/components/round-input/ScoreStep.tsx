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
import { YakumanSelectModal } from './YakumanSelectModal';

interface ScoreStepProps {
  winner: string | null;
  winType: WinType;
  currentDealer: string;
  multiWinners: MultiWinnerDraft[];
  onSelectSingleScore: (p: { pts: number; han: number; fu: number; yakumanNames?: string[] }) => void;
  onUpdateMultiWinnerScore: (winner: string, pts: number, han: number, fu: number, yakumanNames?: string[]) => void;
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
  // 役満選択モーダル
  const [showYakumanModal, setShowYakumanModal] = useState(false);
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
    // 役満（13翻以上）の場合は役満選択モーダルへ誘導
    if (han >= 13) {
      setShowHighOrCustomModal(false);
      setShowYakumanModal(true);
      return;
    }

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

  // 役満選択モーダル適用ハンドラ
  const handleApplyYakuman = (
    selectedNames: string[],
    pts: number,
    han: number,
    fu: number
  ) => {
    if (isMulti) {
      onUpdateMultiWinnerScore(currentTargetWinner, pts, han, fu, selectedNames);
      setShowYakumanModal(false);
      if (activeMultiIdx < multiWinners.length - 1) {
        setActiveMultiIdx((prev) => prev + 1);
      }
    } else {
      onSelectSingleScore({ pts, han, fu, yakumanNames: selectedNames });
      setShowYakumanModal(false);
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
      {/* ─── ヘッダー（和了者を最大強調・冗長文全廃） ─── */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-black text-white tracking-tight truncate">
            {currentTargetWinner}
          </span>
          {isTargetDealer ? (
            <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-600 text-white shadow-sm shrink-0">
              親
            </span>
          ) : (
            <span className="text-xs font-black px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 shrink-0">
              子
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs px-3 py-1.5 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750 font-bold flex items-center gap-1 transition-colors shrink-0"
        >
          ← 戻る
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
                      ? 'bg-white border-white text-black shadow-md'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{mw.winner}</span>
                    {isOya && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                          isSelected
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-600/30 text-rose-300'
                        }`}
                      >
                        親
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs shrink-0 ml-1">
                    {mw.score > 0 ? `${mw.score.toLocaleString()}点` : '未選択'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 3x4 グリッド (11枠 + その他1枠 = 計12枠) ─── */}
      <div className="grid grid-cols-3 gap-2 py-0.5">
        {presets3x4.map((preset) => {
          const isSlash = preset.pointsLabel.includes('/');
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="h-16 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:bg-white active:text-black border border-neutral-800 text-neutral-100 flex flex-col items-center justify-center transition-all touch-manipulation shadow-sm px-1"
            >
              <span
                className={`font-black font-mono leading-tight tracking-tight text-white whitespace-nowrap ${
                  isSlash ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
                }`}
              >
                {preset.pointsLabel}
              </span>
              <span className="text-[11px] font-bold text-neutral-400 mt-0.5 whitespace-nowrap">
                {preset.hanFuLabel}
              </span>
            </button>
          );
        })}

        {/* 12番目の枠: 倍満〜 / その他 */}
        <button
          type="button"
          onClick={() => setShowHighOrCustomModal(true)}
          className="h-16 rounded-xl bg-neutral-850 hover:bg-neutral-800 active:bg-white active:text-black border border-neutral-750 text-neutral-200 font-black flex flex-col items-center justify-center transition-all touch-manipulation shadow-sm px-1"
        >
          <span className="text-sm font-black text-neutral-200 whitespace-nowrap">
            倍満〜 / その他
          </span>
          <span className="text-[10px] font-bold text-neutral-400 mt-0.5 whitespace-nowrap">
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
            className={`w-full h-13 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
              allMultiReady
                ? 'bg-white hover:bg-neutral-200 active:scale-[0.99] text-black cursor-pointer'
                : 'bg-neutral-850 text-neutral-600 cursor-not-allowed border border-neutral-800'
            }`}
          >
            確認画面へ進む →
          </button>
        </div>
      )}

      {/* ─── モーダル: 倍満以上 ＆ 翻・符手動計算 ─── */}
      {showHighOrCustomModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-750 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
            {/* ヘッダー: 和了者名 ＋ 親/子バッジ */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white tracking-tight">
                  {currentTargetWinner}
                </span>
                {isTargetDealer ? (
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-600 text-white shadow-sm">
                    親
                  </span>
                ) : (
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                    子
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowHighOrCustomModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 高打点クイック選択（倍満・三倍満・役満） */}
            <div className="grid grid-cols-3 gap-2">
              {highPresets.map((hp) => (
                <button
                  key={hp.label}
                  type="button"
                  onClick={() => handleApplyCustom(hp.pts, hp.han, hp.fu)}
                  className="h-14 rounded-xl bg-neutral-950 hover:bg-neutral-800 active:bg-white active:text-black border border-neutral-800 text-neutral-200 font-black flex flex-col items-center justify-center transition-all px-1 shadow-sm"
                >
                  <span className="text-sm font-black text-white">{hp.hanFuLabel}</span>
                  <span className="text-xs font-mono text-neutral-400 mt-0.5 whitespace-nowrap">
                    {hp.pointsLabel}
                  </span>
                </button>
              ))}
            </div>

            {/* 翻・符手動セレクタ */}
            <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-black text-neutral-400 block mb-1">
                    翻
                  </label>
                  <select
                    value={customHan}
                    onChange={(e) => setCustomHan(Number(e.target.value))}
                    className="w-full h-12 bg-neutral-950 border border-neutral-700 rounded-xl px-3 text-sm font-black text-white"
                  >
                    {HAN_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h >= 13 ? '13翻 (役満)' : `${h}翻`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-400 block mb-1">
                    符
                  </label>
                  <select
                    value={customFu}
                    onChange={(e) => setCustomFu(Number(e.target.value))}
                    className="w-full h-12 bg-neutral-950 border border-neutral-700 rounded-xl px-3 text-sm font-black text-white"
                  >
                    {FU_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}符
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* リアルタイム計算プレビュー表示 */}
              {(() => {
                const isTsumo = winType === 'tsumo';
                const customScore = calculateScore(customHan, customFu, isTargetDealer, isTsumo);

                return (
                  <>
                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between shadow-inner">
                      <span className="text-xs font-bold text-neutral-400">
                        {customHan}翻 {customFu}符
                      </span>
                      {isTsumo ? (
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-base font-black text-white">
                            {isTargetDealer
                              ? `${customScore.nonDealerPay}オール`
                              : `${customScore.nonDealerPay}/${customScore.dealerPay}`}
                          </span>
                          <span className="text-xs text-neutral-400 font-bold">
                            ({customScore.total}点)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xl font-black text-white font-mono">
                          {customScore.total}点
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyCustom(customScore.total, customHan, customFu)}
                      className="w-full h-12 rounded-xl bg-white hover:bg-neutral-200 active:scale-[0.99] text-black font-black text-sm transition-all shadow-md flex items-center justify-center gap-1 mt-1 cursor-pointer"
                    >
                      点数を確定する →
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── モーダル: 役満選択 ─── */}
      <YakumanSelectModal
        isOpen={showYakumanModal}
        onClose={() => setShowYakumanModal(false)}
        winnerName={currentTargetWinner}
        isDealer={isTargetDealer}
        isTsumo={winType === 'tsumo'}
        onApply={handleApplyYakuman}
      />
    </div>
  );
};
