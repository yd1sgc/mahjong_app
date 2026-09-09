/**
 * 操作パネルUIコンポーネント（記録係と閲覧端末の分岐）
 * 見た目とタップイベントの通知のみを担う
 */

'use client';

import React from 'react';

interface ActionPanelProps {
  isRecorder: boolean;
  passcode: string;
  onOpenWinModal: (type: 'ron' | 'tsumo') => void;
  onOpenRyukyokuModal: () => void;
  onOpenChomboModal: () => void;
  onUndoClick: () => void;
  onOpenTransferModal: () => void;
  canUndo: boolean;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  isRecorder,
  passcode,
  onOpenWinModal,
  onOpenRyukyokuModal,
  onOpenChomboModal,
  onUndoClick,
  onOpenTransferModal,
  canUndo,
}) => {
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
            PIN: <span className="font-bold text-amber-300">{passcode}</span>
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
          {/* メインアクション (ロン / ツモ / 流局) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onOpenWinModal('ron')}
              className="h-14 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-black text-lg shadow-sm transition-all flex items-center justify-center border border-red-500/40 touch-manipulation"
            >
              ロン和了
            </button>

            <button
              type="button"
              onClick={() => onOpenWinModal('tsumo')}
              className="h-14 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-black text-lg shadow-sm transition-all flex items-center justify-center border border-orange-500/40 touch-manipulation"
            >
              ツモ和了
            </button>

            <button
              type="button"
              onClick={onOpenRyukyokuModal}
              className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-white font-bold text-base shadow-sm transition-all flex items-center justify-center border border-neutral-700 touch-manipulation"
            >
              流局
            </button>
          </div>

          {/* サブアクション (チョンボ / 1局巻き戻し) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800/60">
            <button
              type="button"
              onClick={onOpenChomboModal}
              className="h-11 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 font-semibold text-xs transition-colors border border-neutral-700/50 touch-manipulation flex items-center justify-center"
            >
              チョンボ入力
            </button>

            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndoClick}
              className={`h-11 rounded-lg font-semibold text-xs transition-colors border touch-manipulation flex items-center justify-center ${
                canUndo
                  ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-700/50'
                  : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
              }`}
            >
              1局戻す (Undo)
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
    </div>
  );
};
