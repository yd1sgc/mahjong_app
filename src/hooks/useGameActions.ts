/**
 * 対局操作（アクション）フック
 * 局コミット・精算・破棄・Undo・リーチ・副露トグル・PIN交代を担当
 * Supabase RPC（アトミックトランザクション）優先実行 ＋ フォールバック対応
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  calculateGameSettlement,
  getClosestWinner,
  recalculateState,
} from '@/lib/mahjong/rules';
import {
  GameStateSnapshot,
  RoundRecord,
  RuleConfig,
} from '@/types/mahjong';
import {
  GameParticipantRow,
  GameRow,
  RoundSeatInsert,
  Json,
} from '@/types/database';

interface UseGameActionsProps {
  gameId: string;
  game: GameRow | null;
  players: string[];
  participants: GameParticipantRow[];
  ruleConfig: RuleConfig;
  gameState: GameStateSnapshot | null;
  setGameState: React.Dispatch<React.SetStateAction<GameStateSnapshot | null>>;
  isRecorder: boolean;
  setIsRecorder: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  furoDeclared: string[];
  setFuro: (players: string[]) => void;
  clearFuro: () => void;
  clearDraft: () => void;
  saveRecorderToken: (pin: string) => void;
  fetchGameData: () => Promise<void>;
  draftKey: string;
  furoKey: string;
  recorderTokenKey: string;
}

export function useGameActions({
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
      const isAlready = furoDeclared.includes(player);
      const next = isAlready
        ? furoDeclared.filter((p) => p !== player)
        : [...furoDeclared, player];

      setFuro(next);
      if (gameState) {
        setGameState({
          ...gameState,
          furoDeclared: next,
        });
      }
    },
    [isRecorder, furoDeclared, setFuro, gameState, setGameState]
  );

  // 3. リーチ宣言
  const declareRiichi = useCallback(
    (player: string) => {
      if (!gameState || !isRecorder) return;

      const isAlready = gameState.riichiDeclared.includes(player);
      const nextRiichi = isAlready
        ? gameState.riichiDeclared.filter((p) => p !== player)
        : [...gameState.riichiDeclared, player];

      const updated = recalculateState(
        players,
        ruleConfig.basic?.init_score ?? 25000,
        ruleConfig,
        gameState.roundHistory,
        nextRiichi
      );
      setGameState({
        ...updated,
        furoDeclared,
      });
    },
    [gameState, isRecorder, furoDeclared, players, ruleConfig, setGameState]
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
              kyotakuPoint = (gameState.riichiStick + newRound.riichi.length) * riichiPt;
            } else if (isLoser) {
              basePoint = -newRound.score;
              honbaPoint = -gameState.honba * honbaPt;
            }
          } else if (newRound.win_type === 'tsumo') {
            if (isWinner) {
              basePoint = newRound.score;
              honbaPoint = gameState.honba * honbaPt;
              kyotakuPoint = (gameState.riichiStick + newRound.riichi.length) * riichiPt;
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
                kyotakuPoint = (gameState.riichiStick + newRound.riichi.length) * riichiPt;
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
          if (sErr) throw new Error(sErr.message);
        }

        clearDraft();
        clearFuro();

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
      clearFuro,
      fetchGameData,
      setLoading,
      setError,
    ]
  );

  // 5. 1局巻き戻し（Undo）
  const undoRound = useCallback(async (): Promise<boolean> => {
    if (!gameState || !isRecorder || gameState.roundHistory.length === 0) {
      return false;
    }

    try {
      setLoading(true);
      const lastIndex = gameState.roundHistory.length - 1;

      const { error: delErr } = await supabase
        .from('rounds')
        .delete()
        .eq('game_id', gameId)
        .eq('round_index', lastIndex);

      if (delErr) throw new Error(delErr.message);

      clearFuro();
      await fetchGameData();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Undoに失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [gameState, isRecorder, gameId, clearFuro, fetchGameData, setLoading, setError]);

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
      clearFuro();

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
    clearFuro,
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
      clearFuro();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(furoKey);
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
    clearFuro,
    draftKey,
    furoKey,
    recorderTokenKey,
    setLoading,
    setError,
  ]);

  return {
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoRound,
    finishGame,
    abortGame,
  };
}
