/**
 * 対局状態管理ファサードフック
 * docs/DETAILED_DESIGN.md 準拠（3層クリーンアーキテクチャの中間層）
 * 
 * 責務ごとに以下のサブフックへ委譲し、統合インターフェースを提供：
 * - useGameDraft: LocalStorage下書き・副露・PIN管理
 * - useGameData: Supabaseデータ取得・Realtime購読・ドメイン状態再計算
 * - useGameActions: 局コミット・精算・破棄・Undo等のアクション実行
 */

import { useGameDraft, RoundInputDraft, DEFAULT_DRAFT } from './useGameDraft';
import { useGameData } from './useGameData';
import { useGameActions } from './useGameActions';

export type { RoundInputDraft };
export { DEFAULT_DRAFT };

export function useGame(gameId: string) {
  // 1. 下書き・副露・PIN管理サブフック
  const {
    draft,
    hasDraftToRestore,
    furoDeclared,
    updateDraft,
    clearDraft,
    setFuro,
    clearFuro,
    saveRecorderToken,
    recorderTokenKey,
  } = useGameDraft(gameId);

  // 2. データ取得・Realtime同期・ドメイン計算サブフック
  const {
    loading,
    setLoading,
    error,
    setError,
    game,
    players,
    participants,
    ruleConfig,
    gameState,
    setGameState,
    settlement,
    isRecorder,
    setIsRecorder,
    gameEndReason,
    fetchGameData,
  } = useGameData(gameId, recorderTokenKey, furoDeclared);

  const draftKey = `mahjong_draft_${gameId}`;
  const furoKey = `mahjong_furo_${gameId}`;

  // 3. アクション操作（RPC・フォールバック対応）サブフック
  const {
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoRound,
    finishGame,
    abortGame,
  } = useGameActions({
    gameId,
    game,
    players,
    participants,
    ruleConfig,
    gameState,
    setGameState,
    isRecorder,
    setIsRecorder,
    setLoading,
    setError,
    furoDeclared,
    setFuro,
    clearFuro,
    clearDraft,
    saveRecorderToken,
    fetchGameData,
    draftKey,
    furoKey,
    recorderTokenKey,
  });

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
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoRound,
    finishGame,
    abortGame,
    refetch: fetchGameData,
  };
}
