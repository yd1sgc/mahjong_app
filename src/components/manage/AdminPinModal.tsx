/**
 * 管理PIN入力モーダルコンポーネント (AdminPinModal.tsx)
 * 既存データの変更・アーカイブ・復元操作の保護用
 */

'use client';

import React, { useState } from 'react';
import { verifyAdminPin } from '@/lib/adminAuth';

export interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = '管理者PIN認証',
  description = '既存データの変更・アーカイブには3桁の管理PINが必要です。',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPin(pin)) {
      setError(null);
      setPin('');
      onSuccess();
    } else {
      setError('PINコードが一致しません');
      setPin('');
    }
  };

  const handleClose = () => {
    setError(null);
    setPin('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-xs bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-neutral-400 font-bold leading-relaxed">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-bold text-neutral-300 block mb-1">
              3桁PINコード
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              placeholder="3桁の数字"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-center text-lg font-black text-white tracking-widest focus:outline-hidden focus:border-amber-400"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={handleClose}
              className="py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pin.length === 0}
              className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-black font-black text-xs transition-all shadow-xs"
            >
              認証
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
