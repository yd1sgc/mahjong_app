/**
 * 試合ID詳細フィルターアコーディオンコンポーネント (GameFilterAccordion.tsx)
 * 直近N試合クイック選択、全選択、全解除、個別試合チェックボックス一覧
 */

'use client';

import React, { useState } from 'react';
import { GameData } from '@/lib/mahjong/statsCalc';

interface GameFilterAccordionProps {
  baseFilteredGames: GameData[];
  selectedGameIds: string[];
  onToggleGameId: (id: string) => void;
  onQuickSelect: (count: number) => void;
  onClearSelection: () => void;
}

export const GameFilterAccordion: React.FC<GameFilterAccordionProps> = ({
  baseFilteredGames,
  selectedGameIds,
  onToggleGameId,
  onQuickSelect,
  onClearSelection,
}) => {
  const [showAccordion, setShowAccordion] = useState(false);

  return (
    <div className="border-t border-neutral-800 pt-2">
      <button
        type="button"
        onClick={() => setShowAccordion((prev) => !prev)}
        className="w-full text-left text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center justify-between py-1.5"
      >
        <span>
          試合IDで絞り込む（詳細フィルター）
          {selectedGameIds.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
              {selectedGameIds.length} 試合選択中
            </span>
          )}
        </span>
        <span>{showAccordion ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>

      {showAccordion && (
        <div className="mt-2 p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
          {/* クイック選択ボタン群 */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onQuickSelect(1)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
            >
              直近1試合
            </button>
            <button
              type="button"
              onClick={() => onQuickSelect(4)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
            >
              直近4試合
            </button>
            <button
              type="button"
              onClick={() => onQuickSelect(8)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
            >
              直近8試合
            </button>
            <button
              type="button"
              onClick={() => onQuickSelect(-1)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-black"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[11px] font-black"
            >
              選択解除
            </button>
          </div>

          {/* 個別試合チェックボックス一覧 */}
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
            {baseFilteredGames.map((g, idx) => {
              const isSelected = selectedGameIds.includes(g.game_id);
              const topP = g.participants[0]?.name || '不明';
              return (
                <label
                  key={g.game_id}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-neutral-900 text-xs font-mono cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleGameId(g.game_id)}
                      className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                    />
                    <span className="text-neutral-300 font-bold">
                      #{idx + 1} {g.played_at ? g.played_at.slice(0, 16) : ''}
                    </span>
                  </div>
                  <span className="text-neutral-400 text-[11px]">
                    1位: {topP} ({g.rule_name})
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
