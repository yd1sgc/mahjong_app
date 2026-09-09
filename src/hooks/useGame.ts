/**
 * 対局状態管理・Supabase Realtime通信・LocalStorage下書きフック
 * docs/DETAILED_DESIGN.md 準拠（3層クリーンアーキテクチャの中間層）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  checkGameEnd,
  recalculateState,
} from '@/lib/mahjong/rules';
import {
  GameStateSnapshot,
  RoundRecord,
  RuleConfig,
  WinType,
} from '@/types/mahjong';
import { GameRow, MemberRow } from '@/types/database';

export interface RoundInputDraft {
  winType: WinType;
  winner: string | null;
  loser: string | null;
  han: number;
  fu: number;
  tenpai: string[];
  chomboPlayer: string | null;
}

const DEFAULT_DRAFT: RoundInputDraft = {
  winType: 'ron',
  winner: null,
  loser: null,
  han: 1,
  fu: 30,
  tenpai: [],
  chomboPlayer: null,
};

export function useGame(gameId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({});
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [isRecorder, setIsRecorder] = useState(false);
  const [gameEndReason, setGameEndReason] = useState<string | null>(null);

  // LocalStorage 下書き状態
  const [draft, setDraft] = useState<RoundInputDraft>(DEFAULT_DRAFT);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);

  const draftKey = `mahjong_draft_${gameId}`;
  const recorderTokenKey = `mahjong_recorder_${gameId}`;

  // 1. 対局データの初回読み込み
  const fetchGameData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // (1) games 取得
      const { data: gameData, error: gameErr } = await supabase
        .from('games')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (gameErr || !gameData) {
        throw new Error(gameErr?.message || '対局が見つかりません');
      }

      const gRow = gameData as any;
      setGame(gRow);
      const parsedRule = (gRow.rule_config_snapshot as RuleConfig) || {};
      setRuleConfig(parsedRule);

      // (2) 参加者（game_participants）取得（座順 1..4）
      const { data: partData, error: partErr } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', gameId)
        .order('seat', { ascending: true });

      if (partErr) {
        throw new Error(partErr.message);
      }

      const playerList = ((partData as any[]) || []).map((p) => p.player_name_snapshot);
      setPlayers(playerList);

      // (3) 局データ（rounds, round_seats）取得
      const { data: roundRows, error: roundErr } = await supabase
        .from('rounds')
        .select('*, round_seats(*)')
        .eq('game_id', gameId)
        .order('round_index', { ascending: true });

      if (roundErr) {
        throw new Error(roundErr.message);
      }

      // RoundRecord 形式へマッピング
      const history: RoundRecord[] = ((roundRows as any[]) || []).map((r) => {
        const seats: any[] = r.round_seats || [];
        const winnerSeat = seats.find((s) => s.is_winner === 1);
        const loserSeat = seats.find((s) => s.is_loser === 1);
        const riichiList = seats
          .filter((s) => s.is_riichi === 1)
          .map((s) => playerList[s.seat - 1]);
        const tenpaiList = seats
          .filter((s) => s.is_tenpai === 1)
          .map((s) => playerList[s.seat - 1]);

        return {
          kyoku_name: r.kyoku_name,
          winner: winnerSeat ? playerList[winnerSeat.seat - 1] : null,
          loser: loserSeat ? playerList[loserSeat.seat - 1] : null,
          win_type: r.result_type as WinType,
          score: Math.abs(winnerSeat?.base_point || 0),
          riichi: riichiList,
          tenpai: tenpaiList,
        };
      });

      // 純粋ドメイン関数で状態を完全再計算
      const initScore =
        parsedRule.basic?.init_score ?? parsedRule.init_score ?? 25000;
      const computed = recalculateState(playerList, initScore, parsedRule, history);
      setGameState(computed);

      // 終局判定
      const endReason = checkGameEnd(
        computed.scores,
        computed.roundIdx,
        playerList,
        parsedRule,
        history
      );
      setGameEndReason(endReason);

      // (4) 記録係判定
      // ログインユーザーのID一致、またはLocalStorageに保存されたトークン一致
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      const localToken =
        typeof window !== 'undefined'
          ? localStorage.getItem(recorderTokenKey)
          : null;

      const isCurrentRecorder =
        (currentUserId && currentUserId === gRow.recorder_id) ||
        localToken === gRow.passcode;

      setIsRecorder(Boolean(isCurrentRecorder));

      // (5) LocalStorage 下書きチェック
      if (typeof window !== 'undefined') {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setDraft(parsed);
            setHasDraftToRestore(true);
          } catch {
            // パース失敗時は無視
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'データ読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [gameId, draftKey, recorderTokenKey]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // 2. Supabase Realtime 購読（他端末での確定を即時受信）
  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          // 局が追加・更新・削除されたら画面を即時自動再同期
          fetchGameData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          // 記録係交代（passcode/recorder_id 更新）などを反映
          setGame(payload.new as GameRow);
          const localToken = localStorage.getItem(recorderTokenKey);
          if (localToken && localToken === (payload.new as GameRow).passcode) {
            setIsRecorder(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameData, recorderTokenKey]);

  // 3. LocalStorage への下書き保存（1タップごと）
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

  // 下書き破棄
  const clearDraft = useCallback(() => {
    setDraft(DEFAULT_DRAFT);
    setHasDraftToRestore(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  // 4. 4桁PINによる記録係交代（RPC transfer_recorder）
  const transferRecorder = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        if (!game) return false;
        // PINが一致しているか検証
        if (game.passcode !== pin) {
          throw new Error('4桁PINコードが一致しません');
        }

        // LocalStorageに記録係権限トークンを保持
        if (typeof window !== 'undefined') {
          localStorage.setItem(recorderTokenKey, pin);
        }
        setIsRecorder(true);

        // Supabase RPCを呼んでrecorder_idを移譲
        await (supabase.rpc as any)('transfer_recorder', {
          p_game_id: gameId,
          p_pin: pin,
        });

        return true;
      } catch (e: any) {
        throw new Error(e.message || '引き継ぎに失敗しました');
      }
    },
    [game, gameId, recorderTokenKey]
  );

  // 5. リーチ宣言（0ms 楽観的UI更新）
  const declareRiichi = useCallback(
    (player: string) => {
      if (!gameState || !isRecorder) return;
      if (gameState.riichiDeclared.includes(player)) return;

      const nextRiichi = [...gameState.riichiDeclared, player];
      // 0msで画面先行更新
      const updated = recalculateState(
        players,
        ruleConfig.basic?.init_score ?? 25000,
        ruleConfig,
        gameState.roundHistory,
        nextRiichi
      );
      setGameState(updated);
    },
    [gameState, isRecorder, players, ruleConfig]
  );

  // 6. 局結果の確定（コミット）
  const commitRound = useCallback(
    async (newRound: RoundRecord, han?: number, fu?: number): Promise<boolean> => {
      if (!gameState || !game || !isRecorder) return false;

      try {
        setLoading(true);
        const roundId = crypto.randomUUID();
        const roundIndex = gameState.roundHistory.length;

        // (1) rounds テーブルへINSERT
        const { error: rErr } = await (supabase.from('rounds') as any).insert({
          round_id: roundId,
          game_id: gameId,
          round_index: roundIndex,
          kyoku_name: newRound.kyoku_name,
          honba: gameState.honba,
          riichi_sticks: gameState.riichiStick,
          result_type: newRound.win_type,
        });

        if (rErr) throw new Error(rErr.message);

        // (2) round_seats テーブルへ座席データINSERT
        const seatPayloads = players.map((p, idx) => {
          const seat = idx + 1;
          const isWinner = newRound.winner === p ? 1 : 0;
          const isLoser = newRound.loser === p ? 1 : 0;
          const isRiichi = newRound.riichi.includes(p) ? 1 : 0;
          const isTenpai = (newRound.tenpai || []).includes(p) ? 1 : 0;

          return {
            round_id: roundId,
            seat,
            member_id: p, // member_id または snapshot
            base_point: isWinner ? newRound.score : isLoser ? -newRound.score : 0,
            honba_point: 0,
            kyotaku_point: 0,
            penalty_point: 0,
            score_delta: 0,
            chip_delta: 0,
            han: isWinner ? han ?? null : null,
            fu: isWinner ? fu ?? null : null,
            is_winner: isWinner,
            is_loser: isLoser,
            is_riichi: isRiichi,
            is_furo: 0,
            is_tenpai: isTenpai,
          };
        });

        const { error: sErr } = await (supabase.from('round_seats') as any).insert(
          seatPayloads
        );

        if (sErr) throw new Error(sErr.message);

        // (3) 下書きを消去
        clearDraft();

        // (4) 最新データを再取得して画面反映
        await fetchGameData();
        return true;
      } catch (e: any) {
        setError(e.message || '局確定処理に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [gameState, game, isRecorder, gameId, players, clearDraft, fetchGameData]
  );

  // 7. 1局巻き戻し（Undo）
  const undoRound = useCallback(async (): Promise<boolean> => {
    if (!gameState || !isRecorder || gameState.roundHistory.length === 0) {
      return false;
    }

    try {
      setLoading(true);
      const lastIndex = gameState.roundHistory.length - 1;

      // Supabaseから直前の局を削除（CASCADEでround_seatsも自動削除）
      const { error: delErr } = await supabase
        .from('rounds')
        .delete()
        .eq('game_id', gameId)
        .eq('round_index', lastIndex);

      if (delErr) throw new Error(delErr.message);

      await fetchGameData();
      return true;
    } catch (e: any) {
      setError(e.message || 'Undoに失敗しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [gameState, isRecorder, gameId, fetchGameData]);

  return {
    loading,
    error,
    game,
    players,
    ruleConfig,
    gameState,
    isRecorder,
    gameEndReason,
    draft,
    updateDraft,
    clearDraft,
    hasDraftToRestore,
    transferRecorder,
    declareRiichi,
    commitRound,
    undoRound,
    refetch: fetchGameData,
  };
}
