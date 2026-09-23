/**
 * 対局操作（アクション）フック
 * 局コミット・精算・破棄・Undo・リーチ・副露トグル・PIN交代を担当
 * Supabase RPC（アトミックトランザクション）優先実行 ＋ フォールバック対応
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  calculateGameSettlement,
  computeAllRoundsDetails,
  computeRoundSeatDetails,
  getClosestWinner,
  recalculateState,
  canDeclareRiichi,
} from '@/lib/mahjong/rules';
import {
  GameStateSnapshot,
  RoundAction,
  RoundRecord,
  RuleConfig,
} from '@/types/mahjong';
import {
  GameParticipantRow,
  GameRow,
  RoundInsert,
  RoundSeatInsert,
  Json,
} from '@/types/database';

export type UndoResult =
  | { type: 'furo'; player: string }
  | { type: 'riichi'; player: string }
  | { type: 'round'; kyokuName: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }
  | null;

interface UseGameActionsProps {
  gameId: string;
  game: GameRow | null;
  players: string[];
  participants: GameParticipantRow[];
  ruleConfig: RuleConfig;
  baseState: GameStateSnapshot | null;
  gameState: GameStateSnapshot | null;
  isRecorder: boolean;
  setIsRecorder: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  furoDeclared: string[];
  setFuro: (players: string[]) => void;
  clearFuro: () => void;
  riichiDeclared: string[];
  setRiichi: (players: string[]) => void;
  clearRiichi: () => void;
  actionHistory: RoundAction[];
  pushAction: (action: RoundAction) => void;
  removeAction: (type: RoundAction['type'], player: string) => void;
  popAction: () => RoundAction | null;
  clearRoundDeclarations: () => void;
  clearDraft: () => void;
  resetAllRoundData: () => void;
  saveRecorderToken: (pin: string) => void;
  fetchGameData: () => Promise<void>;
  draftKey: string;
  furoKey: string;
  riichiKey: string;
  actionHistoryKey: string;
  recorderTokenKey: string;
}

export function useGameActions({
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
}: UseGameActionsProps) {
  // 1. 4桁PINによる記録係交代（単一トークン排他制御）
  const transferRecorder = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        if (!game) return false;
        if (game.passcode !== pin) {
          throw new Error('4桁PINコードが一致しません');
        }

        // 引き継ぎ成功時に新しい4桁PINを自動生成（前任者の旧PINを無効化）
        const newPin = Math.floor(1000 + Math.random() * 9000).toString();

        // DB上の対局PINを新PINへ更新
        const { error: updateErr } = await supabase
          .from('games')
          .update({ passcode: newPin })
          .eq('game_id', gameId);

        if (updateErr) {
          throw new Error(`PINの更新に失敗しました: ${updateErr.message}`);
        }

        // 新端末のローカルストレージに新PINを保存し、自身を記録係に設定
        saveRecorderToken(newPin);
        setIsRecorder(true);

        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '記録係の交代に失敗しました';
        setError(msg);
        return false;
      }
    },
    [game, gameId, saveRecorderToken, setIsRecorder, setError]
  );

  // 2. 副露（ポン・チー・カン）トグル
  const toggleFuro = useCallback(
    (player: string) => {
      if (!isRecorder) return;
      // 立直済みのプレイヤーは副露不可
      if (riichiDeclared.includes(player)) return;

      const isAlready = furoDeclared.includes(player);
      const next = isAlready
        ? furoDeclared.filter((p) => p !== player)
        : [...furoDeclared, player];

      setFuro(next);
      if (isAlready) {
        removeAction('declare_furo', player);
      } else {
        pushAction({ type: 'declare_furo', player });
      }
    },
    [isRecorder, riichiDeclared, furoDeclared, setFuro, removeAction, pushAction]
  );

  // 3. リーチ宣言
  const declareRiichi = useCallback(
    (player: string) => {
      if (!gameState || !isRecorder) return;

      const isAlready = riichiDeclared.includes(player);
      const isFuro = furoDeclared.includes(player);
      const currentScore = gameState.scores[player] ?? 0;

      // 未立直からの新規宣言時は立直可否（点数および副露）を検証
      if (!isAlready && !canDeclareRiichi(currentScore, ruleConfig, isFuro)) {
        return;
      }

      const nextRiichi = isAlready
        ? riichiDeclared.filter((p) => p !== player)
        : [...riichiDeclared, player];

      setRiichi(nextRiichi);
      if (isAlready) {
        removeAction('declare_riichi', player);
      } else {
        pushAction({ type: 'declare_riichi', player });
      }
    },
    [gameState, isRecorder, ruleConfig, furoDeclared, riichiDeclared, setRiichi, removeAction, pushAction]
  );

  // 4. 局結果の確定（コミット）
  const commitRound = useCallback(
    async (newRound: RoundRecord, han?: number, fu?: number): Promise<boolean> => {
      if (!baseState || !game || !isRecorder) return false;

      try {
        setLoading(true);
        const roundId = crypto.randomUUID();
        const roundIndex = baseState.roundHistory.length;

        const currentScores = baseState.scores;
        const tempHistory = [...baseState.roundHistory, newRound];
        const nextSnapshot = recalculateState(
          players,
          ruleConfig.basic?.init_score ?? 25000,
          ruleConfig,
          tempHistory
        );

        const computedSeats = computeRoundSeatDetails({
          players,
          round: newRound,
          startRiichiSticks: baseState.riichiStick,
          startHonba: baseState.honba,
          scoresBefore: currentScores,
          scoresAfter: nextSnapshot.scores,
          ruleConfig,
          furoPlayers: furoDeclared,
          defaultHan: han,
          defaultFu: fu,
        });

        const seatPayloads: RoundSeatInsert[] = computedSeats.map((s) => {
          const part = participants.find((pt) => pt.seat === s.seat);
          const memberId = part?.member_id || s.player;

          return {
            round_id: roundId,
            seat: s.seat,
            member_id: memberId,
            base_point: s.basePoint,
            honba_point: s.honbaPoint,
            kyotaku_point: s.kyotakuPoint,
            penalty_point: s.penaltyPoint,
            score_delta: s.scoreDelta,
            chip_delta: 0,
            han: s.han ?? null,
            fu: s.fu ?? null,
            is_winner: s.isWinner ? 1 : 0,
            is_loser: s.isLoser ? 1 : 0,
            is_riichi: s.isRiichi ? 1 : 0,
            is_furo: s.isFuro ? 1 : 0,
            is_tenpai: s.isTenpai ? 1 : 0,
          };
        });

        // 1. 役満記録ペイロードの準備（役満和了時）
        const yakumanPayloads: {
          game_id: string;
          round_id: string;
          member_id: string;
          yakuman_name: string;
        }[] = [];

        if (newRound.win_type === 'ron' || newRound.win_type === 'tsumo') {
          if (newRound.winner && newRound.yakuman_names && newRound.yakuman_names.length > 0) {
            const winnerPart = participants.find((p) => p.player_name_snapshot === newRound.winner);
            if (winnerPart) {
              newRound.yakuman_names.forEach((yName) => {
                yakumanPayloads.push({
                  game_id: gameId,
                  round_id: roundId,
                  member_id: winnerPart.member_id,
                  yakuman_name: yName,
                });
              });
            }
          }
        } else if (newRound.win_type === 'multi_ron' && newRound.multi_wins) {
          newRound.multi_wins.forEach((mw) => {
            const yNames = mw.points_data.yakuman_names;
            if (yNames && yNames.length > 0) {
              const winnerPart = participants.find((p) => p.player_name_snapshot === mw.winner);
              if (winnerPart) {
                yNames.forEach((yName) => {
                  yakumanPayloads.push({
                    game_id: gameId,
                    round_id: roundId,
                    member_id: winnerPart.member_id,
                    yakuman_name: yName,
                  });
                });
              }
            }
          });
        }

        // 2. Supabase RPC commit_round_transaction（完全不可分トランザクション実行）
        const { error: rpcErr } = await supabase.rpc('commit_round_transaction', {
          p_round_id: roundId,
          p_game_id: gameId,
          p_round_index: roundIndex,
          p_kyoku_name: newRound.kyoku_name,
          p_honba: baseState.honba,
          p_riichi_sticks: baseState.riichiStick,
          p_result_type: newRound.win_type,
          p_seats: seatPayloads as unknown as Json,
          p_yakumans: yakumanPayloads as unknown as Json,
        });

        if (rpcErr) {
          console.error('commit_round_transaction error:', rpcErr);
          throw new Error(`局確定に失敗しました: ${rpcErr.message}`);
        }

        clearDraft();
        clearRoundDeclarations();

        await fetchGameData();
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '局確定処理に失敗しました';
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [
      baseState,
      game,
      isRecorder,
      gameId,
      players,
      participants,
      furoDeclared,
      ruleConfig,
      clearDraft,
      clearRoundDeclarations,
      fetchGameData,
      setLoading,
      setError,
    ]
  );

  // 5. 操作単位の巻き戻し（Undo）: 局内操作スタック優先 ＋ 前局確定取消（確認ダイアログ付き）
  const isUndoingRef = useRef(false);

  const undoLastAction = useCallback(async (): Promise<UndoResult> => {
    if (!gameState || !isRecorder) return null;
    if (isUndoingRef.current) return null;

    try {
      isUndoingRef.current = true;

      // 1. 局内操作（立直・副露）がスタックに存在する場合: 直前のアクションを解除
      if (actionHistory.length > 0) {
        const lastAction = popAction();
        if (!lastAction) return null;

        if (lastAction.type === 'declare_furo') {
          const next = furoDeclared.filter((p) => p !== lastAction.player);
          setFuro(next);
          return { type: 'furo', player: lastAction.player };
        } else if (lastAction.type === 'declare_riichi') {
          const next = riichiDeclared.filter((p) => p !== lastAction.player);
          setRiichi(next);
          return { type: 'riichi', player: lastAction.player };
        }
        return null;
      }

      // 2. 局内操作がなく、確定済みの局が存在する場合: 直前の確定局を取り消し
      if (gameState.roundHistory.length > 0) {
        const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1];
        const confirmed = typeof window !== 'undefined'
          ? window.confirm(
              `直前の【${lastRound.kyoku_name} ${lastRound.honba}本場】の確定記録を取り消して前の局に戻しますか？\n（入力した局結果が削除されます）`
            )
          : true;

        if (!confirmed) {
          return { type: 'cancelled' };
        }

        setLoading(true);
        const lastIndex = gameState.roundHistory.length - 1;

        // undo_round_transaction RPC による完全不可分削除（役満レコード洗替含む）
        const targetRoundId = lastRound.round_id;
        if (!targetRoundId) {
          throw new Error('削除対象の局IDが見つかりません');
        }

        const { error: rpcErr } = await supabase.rpc('undo_round_transaction', {
          p_game_id: gameId,
          p_round_id: targetRoundId,
        });

        if (rpcErr) {
          console.error('undo_round_transaction error:', rpcErr);
          throw new Error(`巻き戻し処理に失敗しました: ${rpcErr.message}`);
        }

        clearRoundDeclarations();
        await fetchGameData();
        return { type: 'round', kyokuName: lastRound.kyoku_name };
      }

      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '巻き戻し処理に失敗しました';
      setError(msg);
      return { type: 'error', message: msg };
    } finally {
      isUndoingRef.current = false;
      setLoading(false);
    }
  }, [
    gameState,
    isRecorder,
    actionHistory,
    popAction,
    furoDeclared,
    setFuro,
    riichiDeclared,
    setRiichi,
    gameId,
    clearRoundDeclarations,
    fetchGameData,
    setLoading,
    setError,
  ]);


  // 6. 対局の確定・精算終了
  const finishGame = useCallback(async (): Promise<boolean> => {
    if (!gameState || !game || !isRecorder) return false;

    try {
      setLoading(true);
      const settlements = calculateGameSettlement(
        players,
        gameState.scores,
        ruleConfig,
        gameState.riichiStick
      );

      const settlementPayload = settlements.map((s) => ({
        seat: s.seat,
        final_score: s.finalScore,
        rank: s.rank,
        point: s.point,
      }));

      // Supabase RPC settle_game_transaction（完全不可分トランザクション実行）
      const { error: rpcErr } = await supabase.rpc('settle_game_transaction', {
        p_game_id: gameId,
        p_settlements: settlementPayload as unknown as Json,
      });

      if (rpcErr) {
        console.error('settle_game_transaction error:', rpcErr);
        throw new Error(`対局終了処理に失敗しました: ${rpcErr.message}`);
      }

      clearDraft();
      clearRoundDeclarations();

      await fetchGameData();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '対局終了処理に失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    gameState,
    game,
    isRecorder,
    players,
    ruleConfig,
    gameId,
    clearDraft,
    clearRoundDeclarations,
    fetchGameData,
    setLoading,
    setError,
  ]);

  // 7. 対局の破棄（完全削除）
  const abortGame = useCallback(async (): Promise<boolean> => {
    if (!game || !isRecorder) return false;

    try {
      setLoading(true);

      // Supabase RPC abort_game_transaction（完全不可分トランザクション実行）
      const { error: rpcErr } = await supabase.rpc('abort_game_transaction', {
        p_game_id: gameId,
      });

      if (rpcErr) {
        console.error('abort_game_transaction error:', rpcErr);
        throw new Error(`対局破棄に失敗しました: ${rpcErr.message}`);
      }

      clearDraft();
      clearRoundDeclarations();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(furoKey);
        localStorage.removeItem(riichiKey);
        localStorage.removeItem(actionHistoryKey);
        localStorage.removeItem(recorderTokenKey);
      }

      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '対局破棄に失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    game,
    isRecorder,
    gameId,
    clearDraft,
    clearRoundDeclarations,
    draftKey,
    furoKey,
    riichiKey,
    actionHistoryKey,
    recorderTokenKey,
    setLoading,
    setError,
  ]);

  // 8. 過去局の修正およびインプレース再計算・更新（DELETEゼロ、RPC依存ゼロ）
  const updateRoundAndRecalculate = useCallback(
    async (targetRoundIndex: number, updatedRoundData: RoundRecord): Promise<boolean> => {
      if (!gameState || !game || !isRecorder) return false;
      if (
        targetRoundIndex < 0 ||
        targetRoundIndex >= gameState.roundHistory.length
      ) {
        setError('修正対象の局が存在しません');
        return false;
      }

      try {
        setLoading(true);

        // 1. 修正局を差し替えた新しい履歴配列を構築
        const oldHistory = gameState.roundHistory;
        const targetRoundId = oldHistory[targetRoundIndex].round_id;
        const newHistory = [...oldHistory];
        newHistory[targetRoundIndex] = {
          ...updatedRoundData,
          round_id: targetRoundId,
          round_index: targetRoundIndex,
        };

        // 2. 純粋関数 computeAllRoundsDetails で第0局から全再計算
        const initScore = ruleConfig.basic?.init_score ?? 25000;
        const allDetails = computeAllRoundsDetails(
          players,
          initScore,
          ruleConfig,
          newHistory
        );

        // 3. 修正対象局 targetRoundIndex から最新局までの rounds & round_seats を一括 UPSERT
        // （直列多重ループを廃止し、rounds 1回 ＋ round_seats 1回 の計2リクエストで高速・不可分更新）
        const roundsToUpsert: RoundInsert[] = [];
        const seatsToUpsert: RoundSeatInsert[] = [];

        for (let i = targetRoundIndex; i < allDetails.length; i++) {
          const det = allDetails[i];
          const roundId = oldHistory[i].round_id;
          if (!roundId) continue;

          roundsToUpsert.push({
            round_id: roundId,
            game_id: gameId,
            round_index: i,
            kyoku_name: det.kyokuName,
            honba: det.honba,
            riichi_sticks: det.riichiSticks,
            result_type: det.resultType,
          });

          for (const s of det.seatDetails) {
            const part = participants.find((pt) => pt.seat === s.seat);
            const memberId = part?.member_id || s.player;

            seatsToUpsert.push({
              round_id: roundId,
              seat: s.seat,
              member_id: memberId,
              base_point: s.basePoint,
              honba_point: s.honbaPoint,
              kyotaku_point: s.kyotakuPoint,
              penalty_point: s.penaltyPoint,
              score_delta: s.scoreDelta,
              chip_delta: 0,
              is_winner: s.isWinner ? 1 : 0,
              is_loser: s.isLoser ? 1 : 0,
              is_riichi: s.isRiichi ? 1 : 0,
              is_furo: s.isFuro ? 1 : 0,
              is_tenpai: s.isTenpai ? 1 : 0,
              han: s.han ?? null,
              fu: s.fu ?? null,
            });
          }
        }

        // 3.5. 修正対象局の役満レコードペイロード作成
        const editYakumanPayloads: {
          game_id: string;
          round_id: string;
          member_id: string;
          yakuman_name: string;
        }[] = [];

        if (targetRoundId) {
          if (updatedRoundData.win_type === 'ron' || updatedRoundData.win_type === 'tsumo') {
            if (updatedRoundData.winner && updatedRoundData.yakuman_names && updatedRoundData.yakuman_names.length > 0) {
              const winnerPart = participants.find((p) => p.player_name_snapshot === updatedRoundData.winner);
              if (winnerPart) {
                updatedRoundData.yakuman_names.forEach((yName) => {
                  editYakumanPayloads.push({
                    game_id: gameId,
                    round_id: targetRoundId,
                    member_id: winnerPart.member_id,
                    yakuman_name: yName,
                  });
                });
              }
            }
          } else if (updatedRoundData.win_type === 'multi_ron' && updatedRoundData.multi_wins) {
            updatedRoundData.multi_wins.forEach((mw) => {
              const yNames = mw.points_data.yakuman_names;
              if (yNames && yNames.length > 0) {
                const winnerPart = participants.find((p) => p.player_name_snapshot === mw.winner);
                if (winnerPart) {
                  yNames.forEach((yName) => {
                    editYakumanPayloads.push({
                      game_id: gameId,
                      round_id: targetRoundId,
                      member_id: winnerPart.member_id,
                      yakuman_name: yName,
                    });
                  });
                }
              }
            });
          }
        }

        // 3.6. Supabase RPC update_round_recalculate_transaction（完全不可分トランザクション実行）
        const { error: rpcErr } = await supabase.rpc('update_round_recalculate_transaction', {
          p_game_id: gameId,
          p_target_round_id: targetRoundId || '',
          p_rounds: roundsToUpsert as unknown as Json,
          p_seats: seatsToUpsert as unknown as Json,
          p_yakumans: editYakumanPayloads as unknown as Json,
        });

        if (rpcErr) {
          console.error('update_round_recalculate_transaction error:', rpcErr);
          throw new Error(`局データの更新に失敗しました: ${rpcErr.message}`);
        }

        // 4. DB更新が完全に成功した直後にのみ、現在局の未確定ローカルデータ（下書き・副露・立直・履歴）を完全リセット
        resetAllRoundData();

        // 5. 最新の対局データをDBから再読み込みし、画面全体を同期
        await fetchGameData();
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '局の修正・再計算に失敗しました';
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [
      gameState,
      game,
      isRecorder,
      gameId,
      ruleConfig,
      players,
      participants,
      resetAllRoundData,
      fetchGameData,
      setLoading,
      setError,
    ]
  );

  return {
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoLastAction,
    updateRoundAndRecalculate,
    finishGame,
    abortGame,
  };
}
