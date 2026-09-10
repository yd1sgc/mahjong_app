/**
 * トースト通知コンポーネント (Toast)
 * 局確定成功、終局精算、通信エラー時のリトライ通知
 */

'use client';

import React, { useEffect } from 'react';

export interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onRetry?: () => void;
  onClose: () => void;
  duration?: number; // ms
}

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  onRetry,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    // エラーかつ再試行ボタンがある場合は自動で消さない（ユーザーのアクションを待つ）
    if (type === 'error' && onRetry) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [type, onRetry, onClose, duration]);

  const bgStyles = {
    success: 'bg-emerald-900/90 border-emerald-500/80 text-emerald-100',
    error: 'bg-rose-950/95 border-rose-600 text-rose-100 shadow-rose-950/50',
    info: 'bg-neutral-900/95 border-neutral-700 text-neutral-100',
  }[type];

  const badgeStyles = {
    success: 'bg-emerald-500 text-black',
    error: 'bg-rose-600 text-white',
    info: 'bg-amber-500 text-black',
  }[type];

  const label = {
    success: '完了',
    error: 'エラー',
    info: '通知',
  }[type];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-auto">
      <div
        className={`p-3.5 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 ${bgStyles}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${badgeStyles}`}>
            {label}
          </span>
          <span className="text-xs font-bold truncate">
            {message}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white text-xs font-black transition-all shadow-xs"
            >
              再試行
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
