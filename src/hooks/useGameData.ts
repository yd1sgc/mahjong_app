/**
 * 対局データ取得・Realtime購読・ドメイン状態再計算フック
 * Supabase通信および画面復帰（visibilitychange）時の自動再同期を担当
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  checkGameEnd,
  recalculateState,
  calculateGameSettlement,
  SettlementPlayerResult,
} from '@/lib/mahjong/rules';
import {
  GameStateSnapshot,
  RoundRecord,
  RuleConfig,
  WinType,
} from '@/types/mahjong';
import {
  GameRow,
  GameParticipantRow,
  RoundRow,
  RoundSeatRow,
} from '@/types/database';

export interface UseGameDataReturn {
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  game: GameRow | null;
  setGame: React.Dispatch<React.SetStateAction<GameRow | null>>;
  players: string[];
  participants: GameParticipantRow[];
  ruleConfig: RuleConfig;
  gameState: GameStateSnapshot | null;
  setGameState: React.Dispatch<React.SetStateAction<GameStateSnapshot | null>>;
  settlement: SettlementPlayerResult[] | null;
  isRecorder: boolean;
  setIsRecorder: React.Dispatch<React.SetStateAction<boolean>>;
  gameEndReason: string | null;
  fetchGameData: () => Promise<void>;
}

export function useGameData(
  gameId: string,
  recorderTokenKey: string,
  furoDeclared: string[]
): UseGameDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [participants, setParticipants] = useState<GameParticipantRow[]>([]);
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({});
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [settlement, setSettlement] = useState<SettlementPlayerResult[] | null>(null);
  const [isRecorder, setIsRecorder] = useState(false);
  const [gameEndReason, setGameEndReason] = useState<string | null>(null);

  // 二重フェッチ・並行実行防止用 ref
  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // 1. 対局データの読み込み
  const fetchGameData = useCallback(async () => {
    if (!gameId) return;
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
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

      const gRow = gameData as GameRow;
      setGame(gRow);
      const parsedRule = (gRow.rule_config_snapshot as unknown as RuleConfig) || {};
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

      const partList = (partData || []) as GameParticipantRow[];
      setParticipants(partList);
      const playerList = partList.map((p) => p.player_name_snapshot);
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

      type RoundWithSeats = RoundRow & { round_seats: RoundSeatRow[] };
      const typedRounds = (roundRows || []) as unknown as RoundWithSeats[];

      // RoundRecord 形式へマッピング
      const history: RoundRecord[] = typedRounds.map((r) => {
        const seats = r.round_seats || [];
        const winnerSeats = seats.filter((s) => s.is_winner === 1);
        const winnerSeat = winnerSeats[0] || null;
        const loserSeat = seats.find((s) => s.is_loser === 1);
        const riichiSeats = seats.filter((s) => s.is_riichi === 1);
        const tenpaiSeats = seats.filter((s) => s.is_tenpai === 1);

        const winnerPart = winnerSeat
          ? partList.find((p) => p.member_id === winnerSeat.member_id)
          : null;
        const loserPart = loserSeat
          ? partList.find((p) => p.member_id === loserSeat.member_id)
          : null;

        const multiWins =
          r.result_type === 'multi_ron'
            ? winnerSeats.map((ws) => {
                const p = partList.find((pt) => pt.member_id === ws.member_id);
                return {
                  winner: p?.player_name_snapshot || '',
                  points_data: {
                    total: ws.base_point,
                    han: ws.han || 1,
                    fu: ws.fu || 30,
                  },
                };
              })
            : undefined;

        return {
          round_index: r.round_index,
          kyoku_name: r.kyoku_name,
          honba: r.honba,
          win_type: r.result_type as WinType,
          winner: winnerPart?.player_name_snapshot || null,
          loser: loserPart?.player_name_snapshot || null,
          score: winnerSeat?.base_point || 0,
          riichi: riichiSeats
            .map((s) => partList.find((p) => p.member_id === s.member_id)?.player_name_snapshot)
            .filter((name): name is string => Boolean(name)),
          tenpai: tenpaiSeats
            .map((s) => partList.find((p) => p.member_id === s.member_id)?.player_name_snapshot)
            .filter((name): name is string => Boolean(name)),
          multi_wins: multiWins,
        };
      });

      // ドメイン層による現在状態の再計算
      const computed = recalculateState(
        playerList,
        parsedRule.basic?.init_score ?? 25000,
        parsedRule,
        history
      );

      // 対局終了判定
      const endReason = checkGameEnd(
        computed.scores,
        computed.roundIdx,
        playerList,
        parsedRule,
        history
      );
      setGameEndReason(endReason);

      // 終了時の精算計算
      const currentSettlement = calculateGameSettlement(
        playerList,
        computed.scores,
        parsedRule,
        computed.riichiStick
      );
      setSettlement(currentSettlement);

      // (4) 記録係判定
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

      setGameState({
        ...computed,
        furoDeclared,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'データ読み込みに失敗しました';
      setError(msg);
    } finally {
      isFetchingRef.current = false;
      lastFetchTimeRef.current = Date.now();
      setLoading(false);
    }
  }, [gameId, recorderTokenKey, furoDeclared]);

  // 初回マウント時フェッチ
  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // 2. Supabase Realtime 購読（他端末での確定を即時受信、重複フェッチ抑制）
  useEffect(() => {
    if (!gameId) return;

    const debouncedFetch = () => {
      const now = Date.now();
      // 直近 400ms 以内にローカル側でフェッチ完了している場合は二重取得を防止
      if (now - lastFetchTimeRef.current < 400) {
        return;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchGameData();
      }, 250);
    };

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
          debouncedFetch();
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
          const updatedGame = payload.new as GameRow;
          setGame(updatedGame);
          const localToken =
            typeof window !== 'undefined'
              ? localStorage.getItem(recorderTokenKey)
              : null;
          if (localToken && localToken === updatedGame.passcode) {
            setIsRecorder(true);
          }
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameData, recorderTokenKey]);

  // 3. モバイル画面復帰（visibilitychange）時の自動再同期
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchGameData();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [fetchGameData]);

  return {
    loading,
    setLoading,
    error,
    setError,
    game,
    setGame,
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
  };
}
