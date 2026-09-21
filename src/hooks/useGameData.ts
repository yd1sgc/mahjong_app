/**
 * 対局データ取得・Realtime購読・ドメイン状態再計算フック
 * Supabase通信および画面復帰（visibilitychange）時の自動再同期を担当
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { recalculateState } from '@/lib/mahjong/rules';
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
  baseState: GameStateSnapshot | null;
  setBaseState: React.Dispatch<React.SetStateAction<GameStateSnapshot | null>>;
  isRecorder: boolean;
  setIsRecorder: React.Dispatch<React.SetStateAction<boolean>>;
  fetchGameData: () => Promise<void>;
}

export function useGameData(
  gameId: string,
  recorderTokenKey: string
): UseGameDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [participants, setParticipants] = useState<GameParticipantRow[]>([]);
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({});
  const [baseState, setBaseState] = useState<GameStateSnapshot | null>(null);
  const [isRecorder, setIsRecorder] = useState(false);

  // 非同期競合制御（実行中Promiseおよび次回予約Promise）
  const activeFetchPromiseRef = useRef<Promise<void> | null>(null);
  const nextFetchPromiseRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // マウント状態ライフサイクル管理（アンマウント後の非同期コールバック防止）
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. 対局データの読み込み（Promise合流・直列化保証）
  const fetchGameData = useCallback((): Promise<void> => {
    if (!gameId || !isMountedRef.current) {
      return Promise.resolve();
    }

    // A. 現在フェッチが走っていない場合: 直ちにフェッチを開始
    if (!activeFetchPromiseRef.current) {
      const execute = async () => {
        try {
          if (isMountedRef.current) {
            setLoading(true);
            setError(null);
          }

          // (1)〜(4) games, game_participants, rounds, auth をPromise.allで一括並列取得
          const [
            { data: gameData, error: gameErr },
            { data: partData, error: partErr },
            { data: roundRows, error: roundErr },
            { data: authData },
          ] = await Promise.all([
            supabase
              .from('games')
              .select('*')
              .eq('game_id', gameId)
              .single(),
            supabase
              .from('game_participants')
              .select('*')
              .eq('game_id', gameId)
              .order('seat', { ascending: true }),
            supabase
              .from('rounds')
              .select('*, round_seats(*)')
              .eq('game_id', gameId)
              .order('round_index', { ascending: true }),
            supabase.auth.getUser(),
          ]);

          if (!isMountedRef.current) return;

          if (gameErr || !gameData) {
            throw new Error(gameErr?.message || '対局が見つかりません');
          }

          if (partErr) {
            throw new Error(partErr.message);
          }

          if (roundErr) {
            throw new Error(roundErr.message);
          }

          const gRow = gameData as GameRow;
          setGame(gRow);
          const parsedRule = (gRow.rule_config_snapshot as unknown as RuleConfig) || {};
          setRuleConfig(parsedRule);

          const partList = (partData || []) as GameParticipantRow[];
          setParticipants(partList);
          const playerList = partList.map((p) => p.player_name_snapshot);
          setPlayers(playerList);

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
              round_id: r.round_id,
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

          // (4) 記録係判定（authDataはPromise.allで取得済み）
          const currentUserId = authData?.user?.id;
          const localToken =
            typeof window !== 'undefined'
              ? localStorage.getItem(recorderTokenKey)
              : null;

          const isCurrentRecorder =
            (currentUserId && currentUserId === gRow.recorder_id) ||
            localToken === gRow.passcode;

          setIsRecorder(Boolean(isCurrentRecorder));

          setBaseState(computed);
        } catch (e: unknown) {
          if (isMountedRef.current) {
            const msg = e instanceof Error ? e.message : 'データ読み込みに失敗しました';
            setError(msg);
          }
        } finally {
          activeFetchPromiseRef.current = null;
          lastFetchTimeRef.current = Date.now();
          if (isMountedRef.current) {
            setLoading(false);
          }
        }
      };

      const promise = execute();
      activeFetchPromiseRef.current = promise;
      return promise;
    }

    // B. 現在フェッチが実行中の場合:
    // すでに「次回予約Promise」が存在すれば、その予約Promiseを返却して合流（3回以上の重複通信を防止）
    if (nextFetchPromiseRef.current) {
      return nextFetchPromiseRef.current;
    }

    // 「現在のフェッチが完了した直後に、必ず最新データをもう1度取得する」Promiseを予約
    const nextPromise = activeFetchPromiseRef.current
      .then(() => {
        nextFetchPromiseRef.current = null;
        if (!isMountedRef.current) return;
        return fetchGameData();
      })
      .catch(() => {
        nextFetchPromiseRef.current = null;
        if (!isMountedRef.current) return;
        return fetchGameData();
      });

    nextFetchPromiseRef.current = nextPromise;
    return nextPromise;
  }, [gameId, recorderTokenKey]);

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
          const isNowRecorder = Boolean(localToken && localToken === updatedGame.passcode);
          setIsRecorder(isNowRecorder);
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
    baseState,
    setBaseState,
    isRecorder,
    setIsRecorder,
    fetchGameData,
  };
}
