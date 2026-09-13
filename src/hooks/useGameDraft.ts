/**
 * 対局入力下書き（Draft）・副露宣言（Furo）・記録係PIN管理フック
 * LocalStorage との同期およびクラッシュ復元を担当
 */

import { useCallback, useEffect, useState } from 'react';
import { MultiWinnerDraft, RoundAction, WinType } from '@/types/mahjong';

export interface RoundInputDraft {
  winType: WinType;
  winner: string | null;
  loser: string | null;
  han: number;
  fu: number;
  tenpai: string[];
  chomboPlayer: string | null;
  multiWinners?: MultiWinnerDraft[];
  ryukyokuType?: string;
}

export const DEFAULT_DRAFT: RoundInputDraft = {
  winType: 'ron',
  winner: null,
  loser: null,
  han: 1,
  fu: 30,
  tenpai: [],
  chomboPlayer: null,
  multiWinners: [],
  ryukyokuType: 'kyushu',
};

export function useGameDraft(gameId: string) {
  const [draft, setDraft] = useState<RoundInputDraft>(DEFAULT_DRAFT);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const [furoDeclared, setFuroDeclared] = useState<string[]>([]);
  const [riichiDeclared, setRiichiDeclared] = useState<string[]>([]);
  const [actionHistory, setActionHistory] = useState<RoundAction[]>([]);

  const draftKey = `mahjong_draft_${gameId}`;
  const furoKey = `mahjong_furo_${gameId}`;
  const riichiKey = `mahjong_riichi_${gameId}`;
  const actionHistoryKey = `mahjong_action_history_${gameId}`;
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

    // 3. 立直復元
    const savedRiichi = localStorage.getItem(riichiKey);
    if (savedRiichi) {
      try {
        const parsedRiichi = JSON.parse(savedRiichi) as string[];
        if (Array.isArray(parsedRiichi)) {
          setRiichiDeclared(parsedRiichi);
        }
      } catch {
        // パース失敗時は無視
      }
    }

    // 4. 操作履歴復元
    const savedActions = localStorage.getItem(actionHistoryKey);
    if (savedActions) {
      try {
        const parsedActions = JSON.parse(savedActions) as RoundAction[];
        if (Array.isArray(parsedActions)) {
          setActionHistory(parsedActions);
        }
      } catch {
        // パース失敗時は無視
      }
    }
  }, [gameId, draftKey, furoKey, riichiKey, actionHistoryKey]);

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

  // 立直状態の更新（LocalStorage即時同期）
  const setRiichi = useCallback(
    (players: string[]) => {
      setRiichiDeclared(players);
      if (typeof window !== 'undefined') {
        localStorage.setItem(riichiKey, JSON.stringify(players));
      }
    },
    [riichiKey]
  );

  // 立直消去
  const clearRiichi = useCallback(() => {
    setRiichiDeclared([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(riichiKey);
    }
  }, [riichiKey]);

  // 操作履歴の追加（LocalStorage即時同期）
  const pushAction = useCallback(
    (action: RoundAction) => {
      setActionHistory((prev) => {
        const next = [...prev, { ...action, timestamp: Date.now() }];
        if (typeof window !== 'undefined') {
          localStorage.setItem(actionHistoryKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [actionHistoryKey]
  );

  // 操作履歴からの特定操作除去（スコアボード直接タップ解除用）
  const removeAction = useCallback(
    (type: RoundAction['type'], player: string) => {
      setActionHistory((prev) => {
        const idx = prev.map((a) => `${a.type}:${a.player}`).lastIndexOf(`${type}:${player}`);
        if (idx === -1) return prev;
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        if (typeof window !== 'undefined') {
          localStorage.setItem(actionHistoryKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [actionHistoryKey]
  );

  // 直前操作のポップ取り出し
  const popAction = useCallback((): RoundAction | null => {
    let popped: RoundAction | null = null;
    setActionHistory((prev) => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      if (typeof window !== 'undefined') {
        localStorage.setItem(actionHistoryKey, JSON.stringify(next));
      }
      return next;
    });
    return popped;
  }, [actionHistoryKey]);

  // 局中宣言（副露・立直・操作履歴）の一括消去
  const clearRoundDeclarations = useCallback(() => {
    setFuroDeclared([]);
    setRiichiDeclared([]);
    setActionHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(furoKey);
      localStorage.removeItem(riichiKey);
      localStorage.removeItem(actionHistoryKey);
    }
  }, [furoKey, riichiKey, actionHistoryKey]);

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
    riichiDeclared,
    actionHistory,
    updateDraft,
    clearDraft,
    setFuro,
    clearFuro,
    setRiichi,
    clearRiichi,
    pushAction,
    removeAction,
    popAction,
    clearRoundDeclarations,
    getRecorderToken,
    saveRecorderToken,
    recorderTokenKey,
    riichiKey,
    furoKey,
    actionHistoryKey,
    draftKey,
  };
}
