import { beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_PIN,
  clearAdminAuth,
  isAdminAuthenticated,
  verifyAdminPin,
} from '../src/lib/adminAuth';

describe('adminAuth: 管理PIN認証ロジック', () => {
  // sessionStorage のインメモリモック
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const fakeSessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    // Node環境で window および sessionStorage をシミュレート
    (global as unknown as { window: unknown }).window = {};
    (global as unknown as { sessionStorage: unknown }).sessionStorage = fakeSessionStorage;
    clearAdminAuth();
  });

  it('定数 ADMIN_PIN が 3桁の "258" であること', () => {
    expect(ADMIN_PIN).toBe('258');
  });

  it('初期状態では未認証（false）であること', () => {
    expect(isAdminAuthenticated()).toBe(false);
  });

  it('正しいPIN "258" を入力すると認証成功（true）となり、認証状態が保持されること', () => {
    const result = verifyAdminPin('258');
    expect(result).toBe(true);
    expect(isAdminAuthenticated()).toBe(true);
  });

  it('前後に空白がある " 258 " でも正しくトリムされて認証成功すること', () => {
    const result = verifyAdminPin(' 258 ');
    expect(result).toBe(true);
    expect(isAdminAuthenticated()).toBe(true);
  });

  it('誤ったPIN（"123", "000", "25", "2580", 空文字）では拒否され、未認証を維持すること', () => {
    expect(verifyAdminPin('123')).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);

    expect(verifyAdminPin('000')).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);

    expect(verifyAdminPin('25')).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);

    expect(verifyAdminPin('2580')).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);

    expect(verifyAdminPin('')).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);
  });

  it('clearAdminAuth() を呼び出すと認証状態が破棄され未認証に戻ること', () => {
    verifyAdminPin('258');
    expect(isAdminAuthenticated()).toBe(true);

    clearAdminAuth();
    expect(isAdminAuthenticated()).toBe(false);
  });
});
