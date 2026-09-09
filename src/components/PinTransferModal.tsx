/**
 * 4桁PINによる記録係引き継ぎモーダル
 * docs/DETAILED_DESIGN.md 第4項準拠
 */

'use client';

import React, { useState } from 'react';

interface PinTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (pin: string) => Promise<boolean>;
}

export const PinTransferModal: React.FC<PinTransferModalProps> = ({
  isOpen,
  onClose,
  onTransfer,
}) => {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (pin.length !== 4 || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const ok = await onTransfer(pin);
      if (ok) {
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e.message || '引き継ぎに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-xs bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-4">
        <div className="text-center">
          <h3 className="text-base font-bold text-white">記録係を引き継ぐ</h3>
          <p className="text-xs text-neutral-400 mt-1">
            卓上の記録係画面に表示されている4桁PINを入力してください
          </p>
        </div>

        {/* 4桁PINディスプレイ */}
        <div className="flex gap-2 my-1">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-12 h-14 rounded-xl border flex items-center justify-center text-2xl font-black transition-colors ${
                pin[idx]
                  ? 'bg-neutral-800 border-amber-500 text-amber-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-600'
              }`}
            >
              {pin[idx] || '•'}
            </div>
          ))}
        </div>

        {errorMessage && (
          <p className="text-xs font-semibold text-red-400 text-center">
            {errorMessage}
          </p>
        )}

        {/* テンキーパッド (0-9, BS) */}
        <div className="grid grid-cols-3 gap-2 w-full mt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'C') setPin('');
                  else if (key === '⌫') handleBackspace();
                  else handleDigit(key);
                }}
                className="h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-white font-bold text-lg transition-colors border border-neutral-700/60 touch-manipulation flex items-center justify-center"
              >
                {key}
              </button>
            )
          )}
        </div>

        {/* 操作ボタン */}
        <div className="flex gap-2 w-full mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={pin.length !== 4 || submitting}
            onClick={handleSubmit}
            className={`flex-1 h-11 rounded-xl font-bold text-xs shadow-md transition-all ${
              pin.length === 4 && !submitting
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            }`}
          >
            {submitting ? '照合中...' : '引き継ぎ確定'}
          </button>
        </div>
      </div>
    </div>
  );
};
