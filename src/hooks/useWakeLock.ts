'use client';

import { useEffect } from 'react';

/**
 * Screen Wake Lock の取得・解放ライフサイクルを管理する関数
 * React に依存しない純粋なライフサイクルロジックとして分離し、
 * テスト容易性・非同期競合制御・3層クリーンアーキテクチャを両立する。
 */
export function setupWakeLock(): () => void {
  // 非対応環境ガード（SSR・非HTTPS・非対応ブラウザ）
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('wakeLock' in navigator) ||
    typeof document === 'undefined'
  ) {
    return () => {};
  }

  let sentinel: WakeLockSentinel | null = null;
  let isMounted = true;

  const requestLock = async () => {
    // 既に有効なロックを保持している場合は二重取得しない
    if (sentinel && !sentinel.released) {
      return;
    }

    try {
      const s = await navigator.wakeLock.request('screen');

      // 取得完了前にアンマウントされていた場合は即座に解放してリーク防止
      if (!isMounted) {
        await s.release().catch(() => {});
        return;
      }

      sentinel = s;

      // OS都合（画面ロック・省電力等）で自動解放された場合のハンドラ
      s.addEventListener('release', () => {
        if (sentinel === s) {
          sentinel = null;
        }
      });
    } catch {
      // 省電力モードによる拒否（NotAllowedError）やポリシー制限は安全に無視
      sentinel = null;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      requestLock();
    }
  };

  // 初回要求
  requestLock();

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // クリーンアップ関数（アンマウント時に実行）
  return () => {
    isMounted = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    if (sentinel) {
      sentinel.release().catch(() => {});
      sentinel = null;
    }
  };
}

/**
 * 対局画面用 Screen Wake Lock フック
 * docs/DETAILED_DESIGN.md 準拠
 * 
 * - 対局画面表示中、スマートフォンの画面自動消灯（スリープ）を防止
 * - 画面離脱（アンマウント）時に自動解放
 * - 別アプリ等からの復帰（visibilitychange: visible）時に自動再取得
 */
export function useWakeLock(): void {
  useEffect(() => {
    return setupWakeLock();
  }, []);
}
