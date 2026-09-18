/**
 * 操作パネルUIコンポーネント（記録係と閲覧端末の分岐）
 * 見た目とタップイベントの通知のみを担う
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ActionPanelProps {
  isRecorder: boolean;
  passcode: string;
  onOpenWinModal: (type: 'ron' | 'tsumo') => void;
  onOpenRyukyokuModal: () => void;
  onOpenChomboModal: () => void;
  onOpenRoundEditModal: () => void;
  onUndoClick: () => void;
  onOpenTransferModal: () => void;
  canUndo: boolean;
  hasIntraRoundAction?: boolean;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  isRecorder,
  passcode,
  onOpenWinModal,
  onOpenRyukyokuModal,
  onOpenChomboModal,
  onOpenRoundEditModal,
  onUndoClick,
  onOpenTransferModal,
  canUndo,
  hasIntraRoundAction = false,
}) => {
  const [showOtherModal, setShowOtherModal] = useState(false);

  return (
    <div className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-md">
      {/* 権限状態インジケータ */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isRecorder ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
            }`}
          ></span>
          <span className="text-xs font-bold text-neutral-300">
            {isRecorder ? '記録係モード (入力可能)' : '閲覧専用モード (リアルタイム同期中)'}
          </span>
        </div>

        {isRecorder ? (
          <div className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
            PIN: <span className="font-bold text-white">{passcode}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
          >
            記録係を引き継ぐ
          </button>
        )}
      </div>

      {/* 記録係専用ボタン群 */}
      {isRecorder ? (
        <div className="flex flex-col gap-2.5">
          {/* メインアクション (和了 / 流局) */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onOpenWinModal('ron')}
              className="h-14 sm:h-16 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-black text-xl shadow-md transition-all flex items-center justify-center border border-rose-500/50 touch-manipulation"
            >
              和了
            </button>

            <button
              type="button"
              onClick={onOpenRyukyokuModal}
              className="h-14 sm:h-16 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:scale-[0.98] text-neutral-100 font-black text-lg shadow-sm transition-all flex items-center justify-center border border-neutral-700 touch-manipulation"
            >
              流局
            </button>
          </div>

          {/* サブアクション: 左が「その他」、右が「1手戻す / 前局を取り消す」 */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800/60">
            <button
              type="button"
              onClick={() => setShowOtherModal(true)}
              className="h-11 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs transition-colors border border-neutral-700/50 touch-manipulation flex items-center justify-center"
            >
              その他
            </button>

            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndoClick}
              className={`h-11 rounded-lg font-semibold text-xs transition-colors border touch-manipulation flex items-center justify-center ${
                canUndo
                  ? hasIntraRoundAction
                    ? 'bg-neutral-800/80 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border-amber-500/30'
                    : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-700/50'
                  : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
              }`}
            >
              {hasIntraRoundAction ? '1手戻す' : '前局を取り消す'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800/80 text-center flex flex-col gap-1.5">
          <p className="text-sm font-medium text-neutral-400">
            卓上の記録係がスコアを入力しています
          </p>
          <p className="text-xs text-neutral-500">
            点数はリアルタイムで自動同期されます（リロード不要）
          </p>
        </div>
      )}

      {/* 「その他」操作選択モーダル */}
      {showOtherModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowOtherModal(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 w-full max-w-xs rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-sm font-bold text-neutral-200">その他の操作</span>
              <button
                type="button"
                onClick={() => setShowOtherModal(false)}
                className="text-neutral-400 hover:text-white text-lg font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowOtherModal(false);
                  onOpenRoundEditModal();
                }}
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-bold text-xs border border-neutral-700 transition-colors flex items-center justify-center"
              >
                局を修正
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowOtherModal(false);
                  onOpenChomboModal();
                }}
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-rose-400 hover:text-rose-300 font-bold text-xs border border-neutral-700 transition-colors flex items-center justify-center"
              >
                チョンボ入力
              </button>

              <button
                type="button"
                onClick={() => setShowOtherModal(false)}
                className="w-full py-2 text-center text-xs text-neutral-400 hover:text-white font-semibold transition-colors mt-1"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
