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
} from '@/types/database';
import { GameData, RoundData } from '@/lib/mahjong/statsCalc';
import { RuleConfig } from '@/types/mahjong';

export interface UseStatsDataReturn {
  games: GameData[];
  rounds: RoundData[];
  groups: GroupRow[];
  rules: RuleTemplateRow[];
  members: MemberRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStatsData(): UseStatsDataReturn {
  const [games, setGames] = useState<GameData[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. games 取得
      const { data: gData, error: gErr } = await supabase
        .from('games')
        .select('*')
        .order('played_at', { ascending: false });
      if (gErr) throw new Error(`games取得失敗: ${gErr.message}`);

      // 2. game_participants 取得
      const { data: pData, error: pErr } = await supabase
        .from('game_participants')
        .select('*');
      if (pErr) throw new Error(`game_participants取得失敗: ${pErr.message}`);

      // 3. rounds 取得
      const { data: rData, error: rErr } = await supabase
        .from('rounds')
        .select('*')
        .order('round_index', { ascending: true });
      if (rErr) throw new Error(`rounds取得失敗: ${rErr.message}`);

      // 4. round_seats 取得
      const { data: sData, error: sErr } = await supabase
        .from('round_seats')
        .select('*');
      if (sErr) throw new Error(`round_seats取得失敗: ${sErr.message}`);

      // 5. groups / rules / members 取得
      const { data: grpData } = await supabase.from('groups').select('*').eq('is_archived', 0);
      const { data: ruleData } = await supabase.from('rule_templates').select('*').eq('is_archived', 0);
      const { data: memData } = await supabase.from('members').select('*').eq('is_archived', 0);

      if (grpData) setGroups(grpData);
      if (ruleData) setRules(ruleData);
      if (memData) setMembers(memData);

      const gamesList: GameRow[] = gData || [];
      const partList: GameParticipantRow[] = pData || [];
      const roundsList: RoundRow[] = rData || [];
      const seatsList: RoundSeatRow[] = sData || [];

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

      setGames(mappedGames);
      setRounds(mappedRounds);
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
    loading,
    error,
    refetch: fetchData,
  };
}
