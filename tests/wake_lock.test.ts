import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupWakeLock } from '../src/hooks/useWakeLock';

interface MockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener: (event: string, callback: () => void) => void;
  _triggerRelease: () => void;
}

function createMockSentinel(): MockSentinel {
  const listeners: Record<string, (() => void)[]> = {};
  const sentinel: MockSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
      sentinel._triggerRelease();
    }),
    addEventListener: vi.fn((event: string, callback: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    removeEventListener: vi.fn((event: string, callback: () => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      }
    }),
    _triggerRelease: () => {
      if (listeners['release']) {
        listeners['release'].forEach(cb => cb());
      }
    },
  };
  return sentinel;
}

describe('useWakeLock: Screen Wake Lock API ライフサイクル管理', () => {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocumentDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');

  let docListeners: Record<string, (() => void)[]> = {};
  let mockRequest: ReturnType<typeof vi.fn>;
  let activeSentinel: MockSentinel;

  beforeEach(() => {
    docListeners = {};
    activeSentinel = createMockSentinel();
    mockRequest = vi.fn().mockImplementation(async (type: string) => {
      if (type === 'screen') {
        return activeSentinel;
      }
      throw new Error('Unsupported type');
    });

    const mockDocument = {
      visibilityState: 'visible',
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (!docListeners[event]) docListeners[event] = [];
        docListeners[event].push(callback);
      }),
      removeEventListener: vi.fn((event: string, callback: () => void) => {
        if (docListeners[event]) {
          docListeners[event] = docListeners[event].filter(cb => cb !== callback);
        }
      }),
    };

    const mockNavigator = {
      wakeLock: {
        request: mockRequest,
      },
    };

    Object.defineProperty(globalThis, 'window', {
      value: {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: mockDocument,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    } else {
      delete (globalThis as unknown as { navigator?: unknown }).navigator;
    }

    if (originalWindowDesc) {
      Object.defineProperty(globalThis, 'window', originalWindowDesc);
    } else {
      delete (globalThis as unknown as { window?: unknown }).window;
    }

    if (originalDocumentDesc) {
      Object.defineProperty(globalThis, 'document', originalDocumentDesc);
    } else {
      delete (globalThis as unknown as { document?: unknown }).document;
    }

    vi.restoreAllMocks();
  });

  it('1. マウント時: navigator.wakeLock.request("screen") が実行され、イベントリスナーが登録されること', async () => {
    const cleanup = setupWakeLock();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith('screen');
    expect(docListeners['visibilitychange']).toBeDefined();
    expect(docListeners['visibilitychange'].length).toBe(1);

    cleanup();
  });

  it('2. アンマウント時: sentinel.release() が実行され、visibilitychange リスナーが解除されること', async () => {
    const cleanup = setupWakeLock();
    await Promise.resolve();

    expect(activeSentinel.release).not.toHaveBeenCalled();

    cleanup();

    expect(activeSentinel.release).toHaveBeenCalledTimes(1);
    expect(docListeners['visibilitychange'].length).toBe(0);
  });

  it('3. 画面復帰時: OSにより解放された後に visibilityState が visible になった場合、自動再取得されること', async () => {
    const cleanup = setupWakeLock();
    await Promise.resolve();

    expect(mockRequest).toHaveBeenCalledTimes(1);

    // OSやブラウザにより自動解放（画面ロック・別アプリ切り替え等）
    activeSentinel.released = true;
    activeSentinel._triggerRelease();

    // 次回リクエスト用の新しい sentinel を用意
    const secondSentinel = createMockSentinel();
    mockRequest.mockResolvedValueOnce(secondSentinel);

    // ブラウザに復帰（visibilitychange: visible）
    (globalThis.document as unknown as { visibilityState: string }).visibilityState = 'visible';
    const visibilityHandler = docListeners['visibilitychange'][0];
    visibilityHandler();

    await Promise.resolve();

    expect(mockRequest).toHaveBeenCalledTimes(2);

    cleanup();
    expect(secondSentinel.release).toHaveBeenCalledTimes(1);
  });

  it('4. 多重取得防止: 既に有効なロックを保持している場合、visibilitychange が発火しても重複リクエストしないこと', async () => {
    const cleanup = setupWakeLock();
    await Promise.resolve();

    expect(mockRequest).toHaveBeenCalledTimes(1);

    // 有効なまま visibilitychange が発火
    const visibilityHandler = docListeners['visibilitychange'][0];
    visibilityHandler();

    await Promise.resolve();

    // 既にロック保持中のため増えない
    expect(mockRequest).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('5. 非対応環境フォールバック: navigator に wakeLock が存在しない場合、例外を投げず何もしないこと', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    expect(() => {
      const cleanup = setupWakeLock();
      cleanup();
    }).not.toThrow();

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('6. SSR/サーバー環境フォールバック: window または document が未定義でも例外を投げず何もしないこと', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;

    expect(() => {
      const cleanup = setupWakeLock();
      cleanup();
    }).not.toThrow();
  });

  it('7. 例外ハンドリング: 省電力モード等でリクエストが reject された場合でも安全にエラーを捕捉すること', async () => {
    mockRequest.mockRejectedValueOnce(new Error('NotAllowedError: Wake Lock rejected by OS power-saving mode'));

    let cleanup: () => void = () => {};
    expect(() => {
      cleanup = setupWakeLock();
    }).not.toThrow();

    await Promise.resolve();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(() => cleanup()).not.toThrow();
  });

  it('8. 非同期競合防止: 要求中にアンマウントされた場合、Promise解決後に即座に release されること', async () => {
    let resolveRequest: (sentinel: MockSentinel) => void = () => {};
    const pendingPromise = new Promise<MockSentinel>(resolve => {
      resolveRequest = resolve;
    });
    mockRequest.mockReturnValueOnce(pendingPromise);

    const cleanup = setupWakeLock();

    // まだ Promise は未解決の状態で画面アンマウントが発生
    cleanup();

    // アンマウント完了後にリクエストが遅れて解決
    resolveRequest(activeSentinel);
    await Promise.resolve();

    // アンマウント済みであることを検知し、即座に release が呼ばれていること
    expect(activeSentinel.release).toHaveBeenCalledTimes(1);
  });
});
