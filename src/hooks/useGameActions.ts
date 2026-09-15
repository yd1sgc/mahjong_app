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
  getClosestWinner,
  recalculateState,
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
  // 1. 4桁PINによる記録係交代
  const transferRecorder = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        if (!game) return false;
        if (game.passcode !== pin) {
          throw new Error('4桁PINコードが一致しません');
        }

        saveRecorderToken(pin);
        setIsRecorder(true);

        try {
          await supabase.rpc('transfer_recorder', {
            p_game_id: gameId,
            p_pin: pin,
          });
        } catch {
          // RPC未配備時はローカル権限保持のみで継続
        }

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
      // 副露済みのプレイヤーは立直不可
      if (furoDeclared.includes(player)) return;

      const riichiPt = ruleConfig.detail?.riichi_pt ?? 1000;
      const currentScore = gameState.scores[player] ?? 0;
      const isAlready = riichiDeclared.includes(player);

      // 未立直の場合は持ち点がリーチ点以上必要
      if (!isAlready && currentScore < riichiPt) {
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
      if (!gameState || !game || !isRecorder) return false;

      try {
        setLoading(true);
        const roundId = crypto.randomUUID();
        const roundIndex = gameState.roundHistory.length;

        const currentScores = gameState.scores;
        const tempHistory = [...gameState.roundHistory, newRound];
        const nextSnapshot = recalculateState(
          players,
          ruleConfig.basic?.init_score ?? 25000,
          ruleConfig,
          tempHistory
        );

        const honbaPt = ruleConfig.detail?.honba_pt ?? 300;
        const riichiPt = ruleConfig.detail?.riichi_pt ?? 1000;

        const multiWins = newRound.multi_wins || [];
        const winNames = multiWins.map((w) => w.winner);
        const closestWinner =
          newRound.win_type === 'multi_ron'
            ? getClosestWinner(players, newRound.loser || '', winNames)
            : '';

        const seatPayloads: RoundSeatInsert[] = players.map((p, idx) => {
          const seat = idx + 1;
          const part = participants.find((pt) => pt.seat === seat);
          const memberId = part?.member_id || p;

          const isWinner =
            newRound.win_type === 'multi_ron'
              ? multiWins.some((w) => w.winner === p) ? 1 : 0
              : newRound.winner === p ? 1 : 0;
          const isLoser = newRound.loser === p ? 1 : 0;
          const isRiichi = newRound.riichi.includes(p) ? 1 : 0;
          const isTenpai = (newRound.tenpai || []).includes(p) ? 1 : 0;
          const isFuro = furoDeclared.includes(p) ? 1 : 0;

          const scoreDelta = (nextSnapshot.scores[p] ?? 0) - (currentScores[p] ?? 0);

          let basePoint = 0;
          let honbaPoint = 0;
          let kyotakuPoint = 0;

          if (newRound.win_type === 'ron') {
            if (isWinner) {
              basePoint = newRound.score;
              honbaPoint = gameState.honba * honbaPt;
              kyotakuPoint = gameState.riichiStick * riichiPt;
            } else if (isLoser) {
              basePoint = -newRound.score;
              honbaPoint = -gameState.honba * honbaPt;
            }
          } else if (newRound.win_type === 'tsumo') {
            if (isWinner) {
              basePoint = newRound.score;
              honbaPoint = gameState.honba * honbaPt;
              kyotakuPoint = gameState.riichiStick * riichiPt;
            } else {
              const riichiDeduct = isRiichi ? -riichiPt : 0;
              const payTotal = scoreDelta - riichiDeduct;
              const honbaEach = -gameState.honba * Math.floor(honbaPt / 3);
              honbaPoint = honbaEach;
              basePoint = payTotal - honbaEach;
            }
          } else if (newRound.win_type === 'multi_ron') {
            if (isWinner) {
              const myWin = multiWins.find((w) => w.winner === p);
              basePoint = myWin?.points_data?.total ?? 0;
              honbaPoint = gameState.honba * honbaPt;
              if (p === closestWinner) {
                kyotakuPoint = gameState.riichiStick * riichiPt;
              }
            } else if (isLoser) {
              const totalBase = multiWins.reduce((sum, w) => sum + (w.points_data?.total ?? 0), 0);
              basePoint = -totalBase;
              honbaPoint = -multiWins.length * (gameState.honba * honbaPt);
            }
          } else if (
            newRound.win_type === 'chombo' ||
            newRound.win_type === 'ryukyoku' ||
            newRound.win_type === 'mid_ryukyoku'
          ) {
            basePoint = scoreDelta;
          }

          return {
            round_id: roundId,
            seat,
            member_id: memberId,
            base_point: basePoint,
            honba_point: honbaPoint,
            kyotaku_point: kyotakuPoint,
            penalty_point: 0,
            score_delta: scoreDelta,
            chip_delta: 0,
            han: isWinner
              ? (newRound.win_type === 'multi_ron'
                  ? multiWins.find((w) => w.winner === p)?.points_data?.han ?? null
                  : han ?? null)
              : null,
            fu: isWinner
              ? (newRound.win_type === 'multi_ron'
                  ? multiWins.find((w) => w.winner === p)?.points_data?.fu ?? null
                  : fu ?? null)
              : null,
            is_winner: isWinner,
            is_loser: isLoser,
            is_riichi: isRiichi,
            is_furo: isFuro,
            is_tenpai: isTenpai,
          };
        });

        // 1. まず Supabase RPC commit_round_transaction を試行
        let rpcSuccess = false;
        try {
          const { error: rpcErr } = await supabase.rpc('commit_round_transaction', {
            p_game_id: gameId,
            p_round_index: roundIndex,
            p_kyoku_name: newRound.kyoku_name,
            p_honba: gameState.honba,
            p_riichi_sticks: gameState.riichiStick,
            p_result_type: newRound.win_type,
            p_seats: seatPayloads as unknown as Json,
          });
          if (!rpcErr) {
            rpcSuccess = true;
          }
        } catch {
          rpcSuccess = false;
        }

        // 2. RPC未配備またはエラー時は通常クエリへフォールバック
        if (!rpcSuccess) {
          const { error: rErr } = await supabase.from('rounds').insert({
            round_id: roundId,
            game_id: gameId,
            round_index: roundIndex,
            kyoku_name: newRound.kyoku_name,
            honba: gameState.honba,
            riichi_sticks: gameState.riichiStick,
            result_type: newRound.win_type,
          });

          if (rErr) throw new Error(rErr.message);

          const { error: sErr } = await supabase.from('round_seats').insert(seatPayloads);
          if (sErr) {
            // ロールバック: round_seats 登録失敗時に rounds レコードを削除して孤立・不整合を防ぐ
            await supabase.from('rounds').delete().eq('round_id', roundId);
            throw new Error(`座席データの保存に失敗したためロールバックしました: ${sErr.message}`);
          }
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
      gameState,
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

        // round_id（主キー）があれば完全一致削除、なければ round_index で削除
        const deleteQuery = lastRound.round_id
          ? supabase.from('rounds').delete().eq('round_id', lastRound.round_id)
          : supabase.from('rounds').delete().eq('game_id', gameId).eq('round_index', lastIndex);

        const { error: delErr } = await deleteQuery;

        if (delErr) throw new Error(delErr.message);

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

      // 1. RPC settle_game_transaction 試行
      let rpcSuccess = false;
      try {
        const { error: rpcErr } = await supabase.rpc('settle_game_transaction', {
          p_game_id: gameId,
          p_settlements: settlementPayload as unknown as Json,
        });
        if (!rpcErr) {
          rpcSuccess = true;
        }
      } catch {
        rpcSuccess = false;
      }

      // 2. フォールバック
      if (!rpcSuccess) {
        const { error: gErr } = await supabase
          .from('games')
          .update({
            status: 'completed',
          })
          .eq('game_id', gameId);

        if (gErr) throw new Error(gErr.message);

        for (const s of settlements) {
          const { error: pErr } = await supabase
            .from('game_participants')
            .update({
              final_score: s.finalScore,
              rank: s.rank,
              point: s.point,
            })
            .eq('game_id', gameId)
            .eq('seat', s.seat);

          if (pErr) throw new Error(pErr.message);
        }
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

      // 1. RPC abort_game_transaction 試行
      let rpcSuccess = false;
      try {
        const { error: rpcErr } = await supabase.rpc('abort_game_transaction', {
          p_game_id: gameId,
        });
        if (!rpcErr) {
          rpcSuccess = true;
        }
      } catch {
        rpcSuccess = false;
      }

      // 2. フォールバック
      if (!rpcSuccess) {
        const { error: delErr } = await supabase
          .from('games')
          .delete()
          .eq('game_id', gameId);

        if (delErr) throw new Error(delErr.message);
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

        if (roundsToUpsert.length > 0) {
          const { error: rErr } = await supabase
            .from('rounds')
            .upsert(roundsToUpsert, { onConflict: 'round_id' });
          if (rErr) {
            throw new Error(`局データの更新に失敗しました: ${rErr.message}`);
          }
        }

        if (seatsToUpsert.length > 0) {
          const { error: sErr } = await supabase
            .from('round_seats')
            .upsert(seatsToUpsert, { onConflict: 'round_id,seat' });
          if (sErr) {
            throw new Error(`座席データの更新に失敗しました: ${sErr.message}`);
          }
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
