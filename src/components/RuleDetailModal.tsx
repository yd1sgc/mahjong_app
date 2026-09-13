/**
 * 詳細ルール確認モーダル (RuleDetailModal.tsx)
 * 過去アプリ（mahjong_personal）準拠：
 * 成績・試合進行には直接影響しないが、どのような取り決めで打っていたか
 * （喰いタン、赤牌、途中流局、パオ、チョンボ、ハウスルールメモ等）を
 * カテゴリ別に体系的に閲覧・確認できるモーダル
 */

'use client';

import React from 'react';
import { generateRuleDescription } from '@/lib/mahjong';
import { RuleConfig } from '@/types/mahjong';

interface RuleDetailModalProps {
  ruleName: string;
  config?: RuleConfig | Record<string, unknown> | null;
  onClose: () => void;
  onEdit?: () => void;
  isOfficial?: boolean;
}

export const RuleDetailModal: React.FC<RuleDetailModalProps> = ({
  ruleName,
  config,
  onClose,
  onEdit,
  isOfficial = false,
}) => {
  const desc = generateRuleDescription(config as RuleConfig);
  const categories = Object.keys(desc);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-white">{ruleName}</h3>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                isOfficial
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
              }`}
            >
              {isOfficial ? '公式' : 'カスタム'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* ルール詳細カテゴリ一覧 */}
        <div className="flex flex-col gap-3">
          {categories.map((cat) => {
            const lines = desc[cat] || [];
            return (
              <div
                key={cat}
                className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-850 flex flex-col gap-1.5"
              >
                <span className="text-xs font-black text-amber-400 border-b border-neutral-850 pb-1">
                  {cat}
                </span>
                <div className="flex flex-col gap-1 pt-0.5">
                  {lines.map((line, idx) => (
                    <span
                      key={idx}
                      className="text-xs text-neutral-300 font-semibold leading-relaxed"
                    >
                      ・{line}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* アクションボタン群 */}
        <div className="flex gap-2 pt-1 border-t border-neutral-850">
          {onEdit && !isOfficial && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="flex-1 h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white text-xs font-black transition-all flex items-center justify-center"
            >
              このルールを編集する
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-neutral-200 text-xs font-black transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
