/**
 * 管理画面用 PIN 認証ユーティリティ
 * メンバー編集・アーカイブ、ルール編集・アーカイブ等の既存データ保護
 */

export const ADMIN_PIN = '258';
const AUTH_STORAGE_KEY = 'mahjong_admin_authenticated';

/**
 * 現在のブラウザセッションで管理PINが認証済みかどうかを判定
 */
export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * PINコードを検証し、一致した場合はセッション認証状態を記録
 * @param inputPin 入力されたPINコード
 * @returns 認証成功時 true、失敗時 false
 */
export function verifyAdminPin(inputPin: string): boolean {
  const normalized = inputPin.trim();
  if (normalized === ADMIN_PIN) {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      } catch {
        // storage disabled fallback
      }
    }
    return true;
  }
  return false;
}

/**
 * 管理認証状態をクリア（ログアウト相当）
 */
export function clearAdminAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // storage disabled fallback
  }
}
