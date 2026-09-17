'use client';

import React, { useState } from 'react';
import { YAKUMAN_CANDIDATES } from '@/types/mahjong';

interface YakumanSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  winnerName: string;
  isDealer: boolean;
  isTsumo: boolean;
  onApply: (selectedYakumans: string[], totalPts: number, han: number, fu: number) => void;
  initialSelected?: string[];
}

export const YakumanSelectModal: React.FC<YakumanSelectModalProps> = ({
  isOpen,
  onClose,
  winnerName,
  isDealer,
  isTsumo,
  onApply,
  initialSelected = [],
}) => {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [customName, setCustomName] = useState('');
  const [customMult, setCustomMult] = useState(1);

  if (!isOpen) return null;

  const toggleYakuman = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // 倍数の合計計算
  const candidateMap = new Map(YAKUMAN_CANDIDATES.map((c) => [c.name, c.mult]));
  let totalMult = 0;
  selected.forEach((name) => {
    totalMult += candidateMap.get(name) ?? 1;
  });
  if (customName.trim()) {
    totalMult += customMult;
  }

  // 1倍満たなければ最低1倍
  const effectiveMult = Math.max(1, totalMult);

  // 素点計算
  const baseYakumanPts = isDealer ? 48000 : 32000;
  const totalPts = baseYakumanPts * effectiveMult;

  // ツモ時/ロン時の表示ラベル
  const pointsLabel = (() => {
    if (isTsumo) {
      if (isDealer) {
        const each = 16000 * effectiveMult;
        return `${each.toLocaleString()}オール`;
      } else {
        const ko = 8000 * effectiveMult;
        const oya = 16000 * effectiveMult;
        return `${ko.toLocaleString()} / ${oya.toLocaleString()}`;
      }
    }
    return `${totalPts.toLocaleString()}点`;
  })();

  const handleConfirm = () => {
    const finalNames = [...selected];
    if (customName.trim()) {
      finalNames.push(customName.trim());
    }
    // 何も選ばれていなければ「役満」
    if (finalNames.length === 0) {
      finalNames.push('役満');
    }
    onApply(finalNames, totalPts, 13 * effectiveMult, 30);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-70 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-750 rounded-2xl p-4 flex flex-col gap-3.5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <div>
            <span className="text-sm font-black text-white">役満の選択</span>
            <span className="text-xs text-neutral-400 ml-2 font-bold">
              ({winnerName} {isDealer ? '親' : '子'})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-base font-bold px-1"
          >
            ✕
          </button>
        </div>

        {/* 役満一覧（通常・ダブル） */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-400">
            役満一覧（複数選択で複合可能）
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {YAKUMAN_CANDIDATES.map((c) => {
              const isSelected = selected.includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => toggleYakuman(c.name)}
                  className={`h-11 rounded-xl font-black text-xs px-2.5 flex items-center justify-between border transition-all text-left ${
                    isSelected
                      ? 'bg-amber-600/30 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-750 text-neutral-300'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {c.mult > 1 && (
                    <span className="text-[10px] text-amber-400 font-bold ml-1 whitespace-nowrap">
                      {c.mult}倍
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* その他自由入力 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
          <span className="text-[11px] font-bold text-neutral-400">
            その他（ローカル役満・詳細なし等）
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="役満名（任意）"
              className="flex-1 bg-neutral-950 border border-neutral-750 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder:text-neutral-600 focus:outline-hidden focus:border-amber-400"
            />
            <select
              value={customMult}
              onChange={(e) => setCustomMult(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-750 rounded-xl px-2 py-2 text-xs text-amber-300 font-bold focus:outline-hidden"
            >
              <option value={1}>1倍役満</option>
              <option value={2}>2倍役満</option>
              <option value={3}>3倍役満</option>
            </select>
          </div>
        </div>

        {/* 決定サマリー・確定ボタン */}
        <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between bg-neutral-950 px-3 py-2 rounded-xl border border-neutral-800">
            <span className="text-xs font-bold text-neutral-400">
              合計: {effectiveMult}倍役満
            </span>
            <span className="text-sm font-black font-mono text-amber-300">
              {pointsLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-md transition-transform active:scale-[0.99]"
            >
              役満を確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
