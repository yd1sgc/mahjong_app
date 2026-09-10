/**
 * 点数選択ステップ (Step 2: プリセットグリッド ＋ 翻符手動計算)
 */

'use client';

import React, { useState } from 'react';
import { WinType } from '@/types/mahjong';
import {
  KO_RON_PRESETS,
  OYA_RON_PRESETS,
  KO_TSUMO_PRESETS,
  OYA_TSUMO_PRESETS,
  HAN_OPTIONS,
  FU_OPTIONS,
} from '@/lib/mahjong/presets';

interface ScoreStepProps {
  winner: string | null;
  winType: WinType;
  isDealerWinner: boolean;
  initialHan: number;
  initialFu: number;
  onSelectPreset: (p: { pts: number; han: number; fu: number }) => void;
  onApplyCustomCalc: (han: number, fu: number) => void;
  onBack: () => void;
}

export const ScoreStep: React.FC<ScoreStepProps> = ({
  winner,
  winType,
  isDealerWinner,
  initialHan,
  initialFu,
  onSelectPreset,
  onApplyCustomCalc,
  onBack,
}) => {
  const [showCustomCalc, setShowCustomCalc] = useState(false);
  const [customHan, setCustomHan] = useState(initialHan || 1);
  const [customFu, setCustomFu] = useState(initialFu || 30);

  const presets =
    winType === 'ron'
      ? isDealerWinner
        ? OYA_RON_PRESETS
        : KO_RON_PRESETS
      : isDealerWinner
      ? OYA_TSUMO_PRESETS
      : KO_TSUMO_PRESETS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-neutral-200">
          Step 3/3: 点数を選択 ({winner} / {winType === 'ron' ? 'ロン' : 'ツモ'})
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-400 hover:text-white underline font-bold"
        >
          方式を変更
        </button>
      </div>

      {/* プリセットボタン一覧 */}
      <div className="grid grid-cols-3 gap-1.5 max-h-[48dvh] overflow-y-auto p-1 bg-neutral-950 rounded-xl border border-neutral-800">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelectPreset(preset)}
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
              onClick={() => onApplyCustomCalc(customHan, customFu)}
              className="w-full h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 font-bold text-xs text-white border border-neutral-700 transition-colors"
            >
              この翻・符で決定
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
