/**
 * 合計集計画面用データ取得カスタムフック (useAggregateData.ts)
 * 3層クリーンアーキテクチャの中間層（Hook層）
 *
 * Supabaseから全対局および参加者データをページネーション付きで取得し、
 * 集計画面向けの GameItem[] 配列へマッピングして提供する。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GameRow, GameParticipantRow } from '@/types/database';
import { fetchAllRows } from '@/lib/supabasePagination';

export interface AggregateParticipant {
  name: string;
  rank: number;
  point: number;
  score: number;
}

export interface GameItem {
  game_id: string;
  played_at: string;
  rule_name: string;
  participants: AggregateParticipant[];
}

export interface UseAggregateDataReturn {
  games: GameItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAggregateData(): UseAggregateDataReturn {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [gList, pList] = await Promise.all([
        fetchAllRows<GameRow>((from, to) =>
          supabase
            .from('games')
            .select('*')
            .order('played_at', { ascending: false })
            .range(from, to)
        ),
        fetchAllRows<GameParticipantRow>((from, to) =>
          supabase
            .from('game_participants')
            .select('*')
            .range(from, to)
        ),
      ]);

      const mapped: GameItem[] = gList.map((g) => {
        const parts = pList
          .filter((p) => p.game_id === g.game_id)
          .sort((a, b) => a.rank - b.rank)
          .map((p) => ({
            name: p.player_name_snapshot,
            rank: p.rank,
            point: Number(p.point),
            score: p.final_score,
          }));

        return {
          game_id: g.game_id,
          played_at: g.played_at || '',
          rule_name: g.rule_name_snapshot || '標準ルール',
          participants: parts,
        };
      });

      setGames(mapped);
    } catch (err: unknown) {
      console.error('Failed to load aggregate data:', err);
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    games,
    loading,
    error,
    refetch: loadData,
  };
}
