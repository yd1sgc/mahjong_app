/**
 * 対局入力下書き（Draft）・副露宣言（Furo）・記録係PIN管理フック
 * LocalStorage との同期およびクラッシュ復元を担当
 */

import { useCallback, useEffect, useState } from 'react';
import { WinType } from '@/types/mahjong';

export interface RoundInputDraft {
  winType: WinType;
  winner: string | null;
  loser: string | null;
  han: number;
  fu: number;
  tenpai: string[];
  chomboPlayer: string | null;
}

export const DEFAULT_DRAFT: RoundInputDraft = {
  winType: 'ron',
  winner: null,
  loser: null,
  han: 1,
  fu: 30,
  tenpai: [],
  chomboPlayer: null,
};

export function useGameDraft(gameId: string) {
  const [draft, setDraft] = useState<RoundInputDraft>(DEFAULT_DRAFT);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const [furoDeclared, setFuroDeclared] = useState<string[]>([]);

  const draftKey = `mahjong_draft_${gameId}`;
  const furoKey = `mahjong_furo_${gameId}`;
  const recorderTokenKey = `mahjong_recorder_${gameId}`;

  // 初期ロード時にLocalStorageから復元
  useEffect(() => {
    if (typeof window === 'undefined' || !gameId) return;

    // 1. 下書き復元
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as RoundInputDraft;
        setDraft(parsed);
        setHasDraftToRestore(true);
      } catch {
        // パース失敗時は無視
      }
    }

    // 2. 副露復元
    const savedFuro = localStorage.getItem(furoKey);
    if (savedFuro) {
      try {
        const parsedFuro = JSON.parse(savedFuro) as string[];
        if (Array.isArray(parsedFuro)) {
          setFuroDeclared(parsedFuro);
        }
      } catch {
        // パース失敗時は無視
      }
    }
  }, [gameId, draftKey, furoKey]);

  // 下書き更新（LocalStorage即時同期）
  const updateDraft = useCallback(
    (updater: Partial<RoundInputDraft> | ((prev: RoundInputDraft) => RoundInputDraft)) => {
      setDraft((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        if (typeof window !== 'undefined') {
          localStorage.setItem(draftKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [draftKey]
  );

  // 下書き消去
  const clearDraft = useCallback(() => {
    setDraft(DEFAULT_DRAFT);
    setHasDraftToRestore(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  // 副露状態の更新（LocalStorage即時同期）
  const setFuro = useCallback(
    (players: string[]) => {
      setFuroDeclared(players);
      if (typeof window !== 'undefined') {
        localStorage.setItem(furoKey, JSON.stringify(players));
      }
    },
    [furoKey]
  );

  // 副露消去
  const clearFuro = useCallback(() => {
    setFuroDeclared([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(furoKey);
    }
  }, [furoKey]);

  // 記録係PINトークン取得
  const getRecorderToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(recorderTokenKey);
  }, [recorderTokenKey]);

  // 記録係PINトークン保存
  const saveRecorderToken = useCallback(
    (pin: string) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem(recorderTokenKey, pin);
    },
    [recorderTokenKey]
  );

  return {
    draft,
    hasDraftToRestore,
    furoDeclared,
    updateDraft,
    clearDraft,
    setFuro,
    clearFuro,
    getRecorderToken,
    saveRecorderToken,
    recorderTokenKey,
  };
}
