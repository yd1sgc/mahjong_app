/**
 * 対局状態管理ファサードフック
 * docs/DETAILED_DESIGN.md 準拠（3層クリーンアーキテクチャの中間層）
 * 
 * 責務ごとに以下のサブフックへ委譲し、統合インターフェースを提供：
 * - useGameDraft: LocalStorage下書き・副露・PIN管理
 * - useGameData: Supabaseデータ取得・Realtime購読・ドメイン状態再計算
 * - useGameActions: 局コミット・精算・破棄・Undo等のアクション実行
 */

import { useMemo } from 'react';
import { useGameDraft, RoundInputDraft, DEFAULT_DRAFT } from './useGameDraft';
import { useGameData } from './useGameData';
import { useGameActions } from './useGameActions';
import {
  checkGameEnd,
  recalculateState,
  calculateGameSettlement,
} from '@/lib/mahjong/rules';
import { GameStateSnapshot } from '@/types/mahjong';

export type { RoundInputDraft };
export { DEFAULT_DRAFT };

export function useGame(gameId: string) {
  // 1. 下書き・副露・立直・PIN管理サブフック（単一情報源）
  const {
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
    resetAllRoundData,
    saveRecorderToken,
    recorderTokenKey,
    riichiKey,
    furoKey,
    actionHistoryKey,
    draftKey,
  } = useGameDraft(gameId);

  // 2. データ取得・Realtime同期サブフック（局履歴に基づくBaseState管理）
  const {
    loading,
    setLoading,
    error,
    setError,
    game,
    players,
    participants,
    ruleConfig,
    baseState,
    isRecorder,
    setIsRecorder,
    fetchGameData,
  } = useGameData(gameId, recorderTokenKey);

  // 3. 現在の局進行状態（gameState）を BaseState と 局中宣言から純粋導出
  const gameState = useMemo<GameStateSnapshot | null>(() => {
    if (!baseState) return null;
    if (riichiDeclared.length === 0 && furoDeclared.length === 0) {
      return {
        ...baseState,
        riichiDeclared: [],
        furoDeclared: [],
      };
    }
    const computed = recalculateState(
      players,
      ruleConfig.basic?.init_score ?? 25000,
      ruleConfig,
      baseState.roundHistory,
      riichiDeclared
    );
    return {
      ...computed,
      riichiDeclared,
      furoDeclared,
    };
  }, [baseState, players, ruleConfig, riichiDeclared, furoDeclared]);

  // 4. 終局判定および精算計算の導出
  const gameEndReason = useMemo(() => {
    if (!gameState) return null;
    return checkGameEnd(
      gameState.scores,
      gameState.roundIdx,
      players,
      ruleConfig,
      gameState.roundHistory
    );
  }, [gameState, players, ruleConfig]);

  const settlement = useMemo(() => {
    if (!gameState) return null;
    return calculateGameSettlement(
      players,
      gameState.scores,
      ruleConfig,
      gameState.riichiStick
    );
  }, [gameState, players, ruleConfig]);

  // 5. アクション操作（RPC・フォールバック対応）サブフック
  const {
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoLastAction,
    updateRoundAndRecalculate,
    finishGame,
    abortGame,
  } = useGameActions({
    gameId,
    game,
    players,
    participants,
    ruleConfig,
    baseState,
    gameState,
    isRecorder,
    setIsRecorder,
    setLoading,
    setError,
    furoDeclared,
    setFuro,
    clearFuro,
    riichiDeclared,
    setRiichi,
    clearRiichi,
    actionHistory,
    pushAction,
    removeAction,
    popAction,
    clearRoundDeclarations,
    clearDraft,
    resetAllRoundData,
    saveRecorderToken,
    fetchGameData,
    draftKey,
    furoKey,
    riichiKey,
    actionHistoryKey,
    recorderTokenKey,
  });

  const canUndo =
    (actionHistory.length > 0) || ((gameState?.roundHistory.length ?? 0) > 0);
  const hasIntraRoundAction = actionHistory.length > 0;

  return {
    loading,
    error,
    game,
    players,
    participants,
    ruleConfig,
    gameState,
    settlement,
    isRecorder,
    gameEndReason,
    draft,
    updateDraft,
    clearDraft,
    hasDraftToRestore,
    actionHistory,
    canUndo,
    hasIntraRoundAction,
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoLastAction,
    updateRoundAndRecalculate,
    finishGame,
    abortGame,
    refetch: fetchGameData,
  };
}
