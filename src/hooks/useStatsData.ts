/**
 * 成績データ取得・マッピングカスタムフック (useStatsData.ts)
 * 3層クリーンアーキテクチャの中間層（Hook層）
 * 
 * Supabaseから全試合・参加者・局・局座席および関連マスタを取得し、
 * ドメイン層（statsCalc.ts）で集計可能な GameData[] / RoundData[] へ整形・提供する。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MemberRow,
  RuleTemplateRow,
  GroupRow,
  GameRow,
  GameParticipantRow,
  RoundRow,
  RoundSeatRow,
  YakumanRecordRow,
} from '@/types/database';
import { GameData, RoundData } from '@/lib/mahjong/statsCalc';
import { RuleConfig } from '@/types/mahjong';

export interface YakumanDisplayItem {
  id: string;
  game_id: string;
  round_id: string | null;
  member_id: string;
  member_name: string;
  played_at: string;
  yakuman_name: string;
  win_type_label: string; // 'ツモ' | 'ロン' | '-'
}

export interface UseStatsDataReturn {
  games: GameData[];
  rounds: RoundData[];
  groups: GroupRow[];
  rules: RuleTemplateRow[];
  members: MemberRow[];
  yakumanRecords: YakumanDisplayItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Supabase (PostgREST) の1,000行取得上限を安全に突破する自動ページネーションヘルパー
async function fetchAllRows<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetcher(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

export function useStatsData(): UseStatsDataReturn {
  const [games, setGames] = useState<GameData[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [yakumanRecords, setYakumanRecords] = useState<YakumanDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 全8テーブルのデータをPromise.allで一括並列取得
      const [
        { data: gData, error: gErr },
        partList,
        roundsList,
        seatsList,
        { data: grpData },
        { data: ruleData },
        { data: memData },
        { data: yData },
      ] = await Promise.all([
        supabase.from('games').select('*').order('played_at', { ascending: false }),
        fetchAllRows<GameParticipantRow>((from, to) =>
          supabase.from('game_participants').select('*').range(from, to)
        ),
        fetchAllRows<RoundRow>((from, to) =>
          supabase.from('rounds').select('*').order('round_index', { ascending: true }).range(from, to)
        ),
        fetchAllRows<RoundSeatRow>((from, to) =>
          supabase.from('round_seats').select('*').range(from, to)
        ),
        supabase.from('groups').select('*').eq('is_archived', 0),
        supabase.from('rule_templates').select('*').eq('is_archived', 0),
        supabase.from('members').select('*').eq('is_archived', 0),
        supabase.from('yakuman_records').select('*').order('created_at', { ascending: false }),
      ]);

      if (gErr) throw new Error(`games取得失敗: ${gErr.message}`);

      if (grpData) setGroups(grpData);
      if (ruleData) setRules(ruleData);
      if (memData) setMembers(memData);

      const yakumanList: YakumanRecordRow[] = yData || [];
      const gamesList: GameRow[] = gData || [];

      // ルールID -> ルール名の正規化マップ作成
      const ruleMap = new Map<string, string>();
      if (ruleData) {
        ruleData.forEach((r) => {
          ruleMap.set(r.rule_id, r.name);
          ruleMap.set(r.name, r.name);
        });
      }

      // GameData へマッピング
      const mappedGames: GameData[] = gamesList.map((g) => {
        const parts = partList
          .filter((p) => p.game_id === g.game_id)
          .sort((a, b) => a.seat - b.seat)
          .map((p) => ({
            seat: p.seat,
            member_id: p.member_id,
            name: p.player_name_snapshot || '不明',
            final_score: p.final_score,
            rank: p.rank,
            point: Number(p.point),
          }));

        const rawRule = g.rule_name_snapshot || '標準ルール';
        const normalizedRule = ruleMap.get(rawRule) || rawRule;

        return {
          game_id: g.game_id,
          played_at: g.played_at || '',
          group_id: g.group_id,
          rule_name: normalizedRule,
          rule_config: (g.rule_config_snapshot as unknown as RuleConfig) || ({} as RuleConfig),
          participants: parts,
        };
      });

      // RoundData へマッピング
      const mappedRounds: RoundData[] = roundsList.map((r) => {
        const seats = seatsList
          .filter((s) => s.round_id === r.round_id)
          .sort((a, b) => a.seat - b.seat)
          .map((s) => ({
            seat: s.seat,
            member_id: s.member_id,
            score_delta: s.score_delta,
            base_point: s.base_point,
            honba_point: s.honba_point,
            kyotaku_point: s.kyotaku_point || 0,
            penalty_point: s.penalty_point || 0,
            is_winner: s.is_winner,
            is_loser: s.is_loser,
            is_riichi: s.is_riichi,
            is_furo: s.is_furo,
            is_tenpai: s.is_tenpai,
          }));

        return {
          round_id: r.round_id,
          game_id: r.game_id,
          round_index: r.round_index,
          kyoku_name: r.kyoku_name,
          honba: r.honba,
          result_type: r.result_type,
          seats,
        };
      });

      // 役満レコードを対局・局・メンバーごとにグループ化して集約
      const memberMap = new Map<string, string>();
      if (memData) {
        memData.forEach((m) => memberMap.set(m.member_id, m.member_name));
      }

      const gameMap = new Map<string, GameRow>();
      gamesList.forEach((g) => gameMap.set(g.game_id, g));

      const roundMap = new Map<string, RoundRow>();
      roundsList.forEach((r) => roundMap.set(r.round_id, r));

      const groupedMap = new Map<
        string,
        {
          id: string;
          game_id: string;
          round_id: string | null;
          member_id: string;
          member_name: string;
          played_at: string;
          yakumans: string[];
          win_type_label: string;
          created_at: string;
        }
      >();

      yakumanList.forEach((y) => {
        const groupKey = y.round_id
          ? `${y.round_id}_${y.member_id}`
          : `${y.game_id}_${y.member_id}_${y.created_at ? y.created_at.slice(0, 16) : ''}`;

        const existing = groupedMap.get(groupKey);
        if (existing) {
          if (!existing.yakumans.includes(y.yakuman_name)) {
            existing.yakumans.push(y.yakuman_name);
          }
        } else {
          const game = gameMap.get(y.game_id);
          const rawDate = game?.played_at || y.created_at || '';
          const dateStr = rawDate ? rawDate.slice(0, 10).replace(/-/g, '/') : '-';
          const memberName = memberMap.get(y.member_id) || '不明';

          let winLabel = '-';
          if (y.round_id) {
            const rd = roundMap.get(y.round_id);
            if (rd) {
              if (rd.result_type === 'tsumo') winLabel = 'ツモ';
              else if (rd.result_type === 'ron' || rd.result_type === 'multi_ron') winLabel = 'ロン';
            }
          }

          groupedMap.set(groupKey, {
            id: y.id,
            game_id: y.game_id,
            round_id: y.round_id,
            member_id: y.member_id,
            member_name: memberName,
            played_at: dateStr,
            yakumans: [y.yakuman_name],
            win_type_label: winLabel,
            created_at: y.created_at,
          });
        }
      });

      const displayItems: YakumanDisplayItem[] = Array.from(groupedMap.values()).map((g) => ({
        id: g.id,
        game_id: g.game_id,
        round_id: g.round_id,
        member_id: g.member_id,
        member_name: g.member_name,
        played_at: g.played_at,
        yakuman_name: g.yakumans.join(' / '),
        win_type_label: g.win_type_label,
      }));

      setGames(mappedGames);
      setRounds(mappedRounds);
      setYakumanRecords(displayItems);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '成績データの取得に失敗しました';
      console.error(msg, err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    games,
    rounds,
    groups,
    rules,
    members,
    yakumanRecords,
    loading,
    error,
    refetch: fetchData,
  };
}
