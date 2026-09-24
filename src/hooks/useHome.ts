/**
 * ホーム画面の取得・対局作成・簡易記録フック
 * 3層クリーンアーキテクチャの中間層（Hook層）
 *
 * 画面はモーダル開閉と入力表示のみ担当し、Supabase 読み書きは本フックへ集約する。
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  GameRow,
  GroupInsert,
  GroupRow,
  Json,
  MemberRow,
  RuleTemplateRow,
} from '@/types/database';
import { SimpleGamePayload } from '@/lib/mahjong/simpleGame';

export interface GroupMembership {
  group_id: string;
  member_id: string;
}

export const LAST_GAME_SETUP_KEY = 'mahjong_last_game_setup';

export interface LastGameSetup {
  groupId: string;
  ruleId: string;
  members: string[];
}

export async function persistSimpleGame(payload: SimpleGamePayload): Promise<void> {
  const gameId = payload.game.game_id;
  const { error: gErr } = await supabase.from('games').insert(payload.game);
  if (gErr) throw new Error(gErr.message || JSON.stringify(gErr));

  const { error: pErr } = await supabase.from('game_participants').insert(
    payload.participants
  );
  if (pErr) {
    await supabase.from('games').delete().eq('game_id', gameId);
    throw new Error(
      `参加者データの保存に失敗したためロールバックしました: ${pErr.message || JSON.stringify(pErr)}`
    );
  }
}

function persistLastGameSetup(setup: LastGameSetup): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_GAME_SETUP_KEY, JSON.stringify(setup));
  } catch {
    // ignore
  }
}

export function useHome() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['', '', '', '']);

  const loadData = useCallback(async () => {
    try {
      const [
        { data: gData },
        { data: mData },
        { data: grpData },
        { data: gmData },
        { data: rData },
      ] = await Promise.all([
        supabase
          .from('games')
          .select('*')
          .order('played_at', { ascending: false })
          .limit(30),
        supabase
          .from('members')
          .select('*')
          .eq('is_archived', 0)
          .order('member_name'),
        supabase
          .from('groups')
          .select('*')
          .eq('is_archived', 0),
        supabase
          .from('group_memberships')
          .select('group_id, member_id'),
        supabase
          .from('rule_templates')
          .select('*')
          .eq('is_archived', 0),
      ]);

      if (gData) setGames(gData);
      if (mData) setMembers(mData);
      if (grpData) setGroups(grpData);
      if (gmData) setGroupMemberships(gmData as GroupMembership[]);
      if (rData && rData.length > 0) {
        setRules(rData);
      }

      try {
        let restored = false;

        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(LAST_GAME_SETUP_KEY);
          if (raw) {
            const saved: LastGameSetup = JSON.parse(raw);
            const groupExists =
              saved.groupId === 'free' ||
              grpData?.some((g) => g.group_id === saved.groupId);
            const ruleExists = rData?.some((r) => r.rule_id === saved.ruleId);
            const validMembers =
              Array.isArray(saved.members) &&
              saved.members.length === 4 &&
              saved.members.every((mId) =>
                mData?.some((m) => m.member_id === mId && m.is_archived === 0)
              );

            if (groupExists && ruleExists && validMembers) {
              setSelectedGroupId(saved.groupId);
              setSelectedRuleId(saved.ruleId);
              setSelectedMembers(saved.members);
              restored = true;
            }
          }
        }

        if (!restored && gData && gData.length > 0) {
          const latestGame = gData[0];
          const { data: pData } = await supabase
            .from('game_participants')
            .select('seat, member_id')
            .eq('game_id', latestGame.game_id)
            .order('seat');

          if (pData && pData.length === 4) {
            const participantIds = pData.map((p) => p.member_id);
            const allMembersValid = participantIds.every((mId) =>
              mData?.some((m) => m.member_id === mId && m.is_archived === 0)
            );

            if (allMembersValid) {
              const targetGroupId = latestGame.group_id || '';
              const targetRule =
                rData?.find((r) => r.name === latestGame.rule_name_snapshot) ||
                rData?.[0];
              const targetRuleId = targetRule?.rule_id || '';

              setSelectedGroupId(targetGroupId);
              if (targetRuleId) setSelectedRuleId(targetRuleId);
              setSelectedMembers(participantIds);

              persistLastGameSetup({
                groupId: targetGroupId,
                ruleId: targetRuleId,
                members: participantIds,
              });
            }
          }
        }
      } catch (restoreErr) {
        console.warn('Failed to restore last game setup:', restoreErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGroupChange = useCallback(
    (newGroupId: string) => {
      setSelectedGroupId(newGroupId);

      if (!newGroupId || newGroupId === 'free') {
        if (rules.length > 0 && !selectedRuleId) {
          setSelectedRuleId(rules[0].rule_id);
        }
        return;
      }

      const targetGroup = groups.find((g) => g.group_id === newGroupId);
      if (targetGroup?.default_rule_id) {
        setSelectedRuleId(targetGroup.default_rule_id);
      }

      const groupMemberIds = groupMemberships
        .filter((gm) => gm.group_id === newGroupId)
        .map((gm) => gm.member_id);

      setSelectedMembers((prev) =>
        prev.map((mId) => {
          if (!mId) return '';
          return groupMemberIds.includes(mId) ? mId : '';
        })
      );
    },
    [groups, groupMemberships, rules, selectedRuleId]
  );

  const resetSetup = useCallback(() => {
    setSelectedGroupId('');
    setSelectedRuleId('');
    setSelectedMembers(['', '', '', '']);
  }, []);

  const rotateSeats = useCallback(() => {
    setSelectedMembers(([e, s, w, n]) => [s, w, n, e]);
  }, []);

  const getAvailableMembersForSeat = useCallback(
    (seatIdx: number): MemberRow[] => {
      const chosenInOtherSeats = selectedMembers.filter(
        (_, idx) => idx !== seatIdx && Boolean(_)
      );

      let pool: MemberRow[] = [];
      if (!selectedGroupId || selectedGroupId === 'free') {
        pool = members;
      } else {
        const allowedMemberIds = groupMemberships
          .filter((gm) => gm.group_id === selectedGroupId)
          .map((gm) => gm.member_id);
        pool = members.filter((m) => allowedMemberIds.includes(m.member_id));
      }

      return pool.filter((m) => !chosenInOtherSeats.includes(m.member_id));
    },
    [groupMemberships, members, selectedGroupId, selectedMembers]
  );

  const getEffectiveGroupId = useCallback(async (): Promise<string> => {
    if (selectedGroupId && selectedGroupId !== 'free') {
      return selectedGroupId;
    }

    let freeGrp = groups.find(
      (g) => g.display_id === 'free' || g.group_name === 'フリー対局'
    );

    if (!freeGrp) {
      const newId = crypto.randomUUID();
      const defaultRuleId = rules[0]?.rule_id || '';
      try {
        const groupPayload: GroupInsert = {
          group_id: newId,
          display_id: 'free',
          group_name: 'フリー対局',
          default_rule_id: defaultRuleId,
          is_archived: 0,
        };
        const { data, error } = await supabase
          .from('groups')
          .insert(groupPayload)
          .select()
          .single();

        if (!error && data) {
          setGroups((prev) => [...prev, data]);
          return data.group_id;
        }
      } catch {
        // フォールバック
      }
      return groups[0]?.group_id || newId;
    }

    return freeGrp.group_id;
  }, [groups, rules, selectedGroupId]);

  const saveCurrentSetup = useCallback(() => {
    persistLastGameSetup({
      groupId: selectedGroupId,
      ruleId: selectedRuleId,
      members: selectedMembers,
    });
  }, [selectedGroupId, selectedRuleId, selectedMembers]);

  const createGame = useCallback(
    async (pin: string): Promise<string> => {
      const gameId = crypto.randomUUID();
      const currentRule = rules.find((r) => r.rule_id === selectedRuleId);
      const ruleName = currentRule?.name || '標準ルール';
      const ruleConfig = currentRule?.config_json || {};
      const effectiveGroupId = await getEffectiveGroupId();

      const participants = selectedMembers.map((mId, idx) => {
        const mem = members.find((m) => m.member_id === mId);
        return {
          seat: idx + 1,
          member_id: mId,
          player_name_snapshot: mem?.member_name || `P${idx + 1}`,
          final_score: 25000,
          rank: idx + 1,
          point: 0.0,
          was_group_member: 1,
        };
      });

      const { error: rpcErr } = await supabase.rpc('create_game_transaction', {
        p_game_id: gameId,
        p_group_id: effectiveGroupId,
        p_passcode: pin,
        p_rule_name: ruleName,
        p_rule_config: ruleConfig as unknown as Json,
        p_participants: participants as unknown as Json,
      });

      if (rpcErr) {
        console.error('create_game_transaction error:', rpcErr);
        throw new Error(rpcErr.message);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`mahjong_recorder_${gameId}`, pin);
      }
      persistLastGameSetup({
        groupId: selectedGroupId,
        ruleId: selectedRuleId,
        members: selectedMembers,
      });

      return gameId;
    },
    [getEffectiveGroupId, members, rules, selectedGroupId, selectedMembers, selectedRuleId]
  );

  const isReadyToCreate = Boolean(
    selectedGroupId &&
      selectedRuleId &&
      selectedMembers.filter(Boolean).length === 4
  );

  const simpleGameGroupId =
    selectedGroupId === 'free'
      ? groups.find((g) => g.display_id === 'free')?.group_id || groups[0]?.group_id
      : selectedGroupId;

  return {
    games,
    members,
    groups,
    groupMemberships,
    rules,
    loading,
    selectedGroupId,
    selectedRuleId,
    selectedMembers,
    setSelectedRuleId,
    setSelectedMembers,
    handleGroupChange,
    resetSetup,
    rotateSeats,
    getAvailableMembersForSeat,
    isReadyToCreate,
    simpleGameGroupId: simpleGameGroupId || '',
    loadData,
    saveCurrentSetup,
    createGame,
    persistSimpleGame,
  };
}
