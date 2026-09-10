/**
 * 対局データ取得・Realtime購読・ドメイン状態再計算フック
 * Supabase通信および画面復帰（visibilitychange）時の自動再同期を担当
 */

import { useCallback, useEffect, useState } from 'react';
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

  // 1. 対局データの読み込み
  const fetchGameData = useCallback(async () => {
    if (!gameId) return;

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
      const initScore = parsedRule.basic?.init_score ?? 25000;
      const computed = recalculateState(playerList, initScore, parsedRule, history);

      // 終局判定
      const endReason = checkGameEnd(
        computed.scores,
        computed.roundIdx,
        playerList,
        parsedRule,
        history
      );
      setGameEndReason(endReason);

      // 精算プレビュー計算（供託加算・ウマオカ・0.0ptゼロ和）
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
      setLoading(false);
    }
  }, [gameId, recorderTokenKey, furoDeclared]);

  // 初回マウント時フェッチ
  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // 2. Supabase Realtime 購読（他端末での確定を即時受信）
  useEffect(() => {
    if (!gameId) return;

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
          const updatedGame = payload.new as GameRow;
          setGame(updatedGame);
          const localToken =
            typeof window !== 'undefined'
              ? localStorage.getItem(recorderTokenKey)
              : null;
          if (localToken && localToken === updatedGame.passcode) {
            setIsRecorder(true);
          }
        }
      )
      .subscribe();

    return () => {
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
