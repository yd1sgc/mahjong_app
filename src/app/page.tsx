/**
 * ホーム画面：対局開始・中断再開・成績・管理導線
 * mahjong_personal 準拠：中断対局の自動検知バナー・目的別大ボタン・絵文字なし
 * 
 * グループ未選択初期化・フリー対局・ルール自動連動・メンバー絞り込み・重複除外対応
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  GameInsert,
  GameParticipantInsert,
  GameRow,
  GroupInsert,
  GroupRow,
  MemberRow,
  RuleTemplateRow,
} from '@/types/database';
import { SimpleGameInputModal } from '@/components/SimpleGameInputModal';
import { RuleDetailModal } from '@/components/RuleDetailModal';
import { RuleConfig } from '@/types/mahjong';

interface GroupMembership {
  group_id: string;
  member_id: string;
}

const LAST_GAME_SETUP_KEY = 'mahjong_last_game_setup';

interface LastGameSetup {
  groupId: string;
  ruleId: string;
  members: string[];
}

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<GameRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 新規対局モーダル用状態
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showSimpleModal, setShowSimpleModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(''); // 初期値: '' (未選択)
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['', '', '', '']);
  const [creating, setCreating] = useState(false);
  const [detailModalRule, setDetailModalRule] = useState<RuleTemplateRow | null>(null);

  // キャッシュ更新用状態
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 5つのテーブル・クエリをPromise.allで一括並列取得
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

      // 直前の対局設定（グループ・ルール・メンバー4名）の自動復元
      try {
        let restored = false;

        // 1. localStorage からの復元試行
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

        // 2. localStorage に無い場合、DB上の直近対局レコードから復元
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

              if (typeof window !== 'undefined') {
                localStorage.setItem(
                  LAST_GAME_SETUP_KEY,
                  JSON.stringify({
                    groupId: targetGroupId,
                    ruleId: targetRuleId,
                    members: participantIds,
                  })
                );
              }
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

  // キャッシュ・最新データ更新ハンドラ
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // 1. Cache Storage のクリア
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // 2. Service Worker の更新チェック
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      // 3. Supabase 最新データの再取得
      await loadData();
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 1500);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // 進行中の対局を検知
  const activeGame = games.find((g) => g.status === 'in_progress');

  // グループ変更ハンドラ (ルール自動反映 ＆ メンバー所属整合性検証)
  const handleGroupChange = (newGroupId: string) => {
    setSelectedGroupId(newGroupId);

    // グループ未選択（'' または 'free'）の場合はリセット・全メンバー解放
    if (!newGroupId || newGroupId === 'free') {
      if (rules.length > 0 && !selectedRuleId) {
        setSelectedRuleId(rules[0].rule_id);
      }
      return;
    }

    // 1. グループの既定ルールを反映
    const targetGroup = groups.find((g) => g.group_id === newGroupId);
    if (targetGroup?.default_rule_id) {
      setSelectedRuleId(targetGroup.default_rule_id);
    }

    // 2. 現在選択済みのメンバーが、変更先グループに所属しているか検証
    // 所属していない（外部・別グループの）メンバーは選択解除
    const groupMemberIds = groupMemberships
      .filter((gm) => gm.group_id === newGroupId)
      .map((gm) => gm.member_id);

    setSelectedMembers((prev) =>
      prev.map((mId) => {
        if (!mId) return '';
        return groupMemberIds.includes(mId) ? mId : '';
      })
    );
  };

  // 座席ごとの選択可能メンバー候補を取得
  const getAvailableMembersForSeat = (seatIdx: number): MemberRow[] => {
    // 他の座席で既に選択されているメンバーID一覧
    const chosenInOtherSeats = selectedMembers.filter((_, idx) => idx !== seatIdx && Boolean(_));

    let pool: MemberRow[] = [];
    if (!selectedGroupId || selectedGroupId === 'free') {
      // グループ未選択またはフリー対局: 全メンバー
      pool = members;
    } else {
      // 特定グループ選択時: そのグループの所属メンバーのみ
      const allowedMemberIds = groupMemberships
        .filter((gm) => gm.group_id === selectedGroupId)
        .map((gm) => gm.member_id);
      pool = members.filter((m) => allowedMemberIds.includes(m.member_id));
    }

    return pool.filter((m) => !chosenInOtherSeats.includes(m.member_id));
  };

  // フリー対局用の有効な group_id を取得（無ければ自動生成）
  const getEffectiveGroupId = async (): Promise<string> => {
    if (selectedGroupId && selectedGroupId !== 'free') {
      return selectedGroupId;
    }

    // フリー対局用グループを探索
    let freeGrp = groups.find(
      (g) => g.display_id === 'free' || g.group_name === 'フリー対局'
    );

    if (!freeGrp) {
      // 存在しなければ自動作成
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
  };

  // プレイヤー選択の検証
  const validateSelectedPlayers = (): boolean => {
    if (!selectedGroupId) {
      alert('グループを選択してください');
      return false;
    }
    const validMembers = selectedMembers.filter(Boolean);
    if (validMembers.length !== 4) {
      alert('4名のプレイヤーを選択してください');
      return false;
    }
    if (new Set(validMembers).size !== 4) {
      alert('プレイヤーが重複しています。異なる4名を選択してください');
      return false;
    }
    return true;
  };

  // 結果のみ入力モード開始
  const handleStartSimpleGame = () => {
    if (!validateSelectedPlayers()) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          LAST_GAME_SETUP_KEY,
          JSON.stringify({
            groupId: selectedGroupId,
            ruleId: selectedRuleId,
            members: selectedMembers,
          })
        );
      } catch {
        // ignore
      }
    }
    setShowNewGameModal(false);
    setShowSimpleModal(true);
  };

  // 新規対局作成処理（詳細入力）
  const handleCreateGame = async () => {
    if (!validateSelectedPlayers()) return;

    const pin = (document.getElementById('game-pin') as HTMLInputElement)?.value;
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      alert('引き継ぎ用の4桁PIN番号（数字4文字）を入力してください');
      return;
    }

    try {
      setCreating(true);
      const gameId = crypto.randomUUID();
      const currentRule = rules.find((r) => r.rule_id === selectedRuleId);
      const ruleName = currentRule?.name || '標準ルール';
      const ruleConfig = currentRule?.config_json || {};
      const effectiveGroupId = await getEffectiveGroupId();

      // 1. games レコード作成
      const gamePayload: GameInsert = {
        game_id: gameId,
        group_id: effectiveGroupId,
        passcode: pin,
        rule_name_snapshot: ruleName,
        rule_config_snapshot: ruleConfig,
        status: 'in_progress',
        sync_target: 1,
        is_synced: 1,
      };
      const { error: gErr } = await supabase.from('games').insert(gamePayload);

      if (gErr) {
        console.error('games insert error:', gErr);
        throw new Error(gErr.message || JSON.stringify(gErr));
      }

      // 2. game_participants 作成
      const participants: GameParticipantInsert[] = selectedMembers.map((mId, idx) => {
        const mem = members.find((m) => m.member_id === mId);
        return {
          game_id: gameId,
          seat: idx + 1,
          member_id: mId,
          player_name_snapshot: mem?.member_name || `P${idx + 1}`,
          final_score: 25000,
          rank: idx + 1,
          point: 0.0,
        };
      });

      const { error: pErr } = await supabase
        .from('game_participants')
        .insert(participants);

      if (pErr) {
        console.error('game_participants insert error:', pErr);
        throw new Error(pErr.message || JSON.stringify(pErr));
      }

      // 3. この端末を記録係としてトークン保存 ＆ 直前設定として保存
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mahjong_recorder_${gameId}`, pin);
        try {
          localStorage.setItem(
            LAST_GAME_SETUP_KEY,
            JSON.stringify({
              groupId: selectedGroupId,
              ruleId: selectedRuleId,
              members: selectedMembers,
            })
          );
        } catch {
          // ignore
        }
      }

      // 対局画面へ遷移
      router.push(`/game?id=${gameId}`);
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      alert(`対局作成に失敗しました: ${errMsg}`);
    } finally {
      setCreating(false);
    }
  };

  const isReadyToCreate = Boolean(
    selectedGroupId &&
    selectedRuleId &&
    selectedMembers.filter(Boolean).length === 4
  );

  return (
    <main className="w-full min-h-screen bg-black text-white max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      {/* アプリヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          麻雀スコア管理
        </h1>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="キャッシュ・データを最新化"
          className="h-9 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 text-neutral-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-white' : ''}`} />
          <span>{refreshing ? '更新中' : refreshed ? '完了' : '更新'}</span>
        </button>
      </header>

      {/* 中断対局の再開案内バナー (mahjong_personal準拠) */}
      {activeGame && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border-2 border-amber-500/60 shadow-lg flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-500 text-black">
              進行中の対局
            </span>
            <span className="text-xs text-neutral-300 font-bold">
              {activeGame.played_at?.slice(5, 16).replace('T', ' ')}
            </span>
          </div>
          <p className="text-sm font-black text-amber-200">
            {activeGame.rule_name_snapshot} の対局が進行中です。再開しますか？
          </p>
          <div className="flex gap-2 pt-1">
            <Link
              href={`/game?id=${activeGame.game_id}`}
              className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-black text-sm shadow-md transition-all flex items-center justify-center"
            >
              対局を再開する
            </Link>
          </div>
        </div>
      )}

      {/* メインアクションボタン群 */}
      <div className="flex flex-col gap-3">
        {/* 1段目: 対局を始める */}
        <button
          type="button"
          onClick={() => {
            setShowNewGameModal(true);
          }}
          className="h-16 sm:h-20 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-black text-lg sm:text-xl shadow-lg border border-rose-500/50 transition-all flex items-center justify-center touch-manipulation"
        >
          対局を始める
        </button>

        {/* 2段目: 成績を見る */}
        <Link
          href="/stats"
          className="h-14 sm:h-16 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-100 font-black text-base transition-all flex items-center justify-center shadow-xs"
        >
          成績を見る
        </Link>

        {/* 3段目: 左にルール管理、右にグループ管理 */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/manage/rules"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            ルール管理
          </Link>

          <Link
            href="/manage/groups"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            グループ・メンバー
          </Link>
        </div>

        {/* 4段目: 左にデータ管理、右に合計集計 */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/manage/system"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            データ管理
          </Link>

          <Link
            href="/aggregate"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            合計集計
          </Link>
        </div>
      </div>

      {/* 新規対局モーダル */}
      {showNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">新規対局の開始</h3>
                {selectedGroupId && selectedMembers.filter(Boolean).length === 4 && (
                  <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                    直前の対局設定を自動反映中
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedGroupId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId('');
                      setSelectedRuleId('');
                      setSelectedMembers(['', '', '', '']);
                    }}
                    className="text-[11px] font-bold text-neutral-400 hover:text-white px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 transition-colors"
                  >
                    リセット
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewGameModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* グループ選択 (初期未選択 ＋ フリー対局選択肢) */}
            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局グループ
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                className={`w-full h-11 bg-neutral-950 border rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-amber-500 ${
                  !selectedGroupId
                    ? 'border-amber-500/60 text-neutral-400'
                    : 'border-neutral-800 text-white'
                }`}
              >
                <option value="">グループを選択してください</option>
                {groups
                  .filter(
                    (g) => g.display_id !== 'free' && g.group_name !== 'フリー対局'
                  )
                  .map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.group_name}
                    </option>
                  ))}
                <option value="free">フリー対局</option>
              </select>
            </div>

            {/* ルール選択 (グループ選択時に自動セット・変更可能) */}
            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局ルール
              </label>
              <select
                value={selectedRuleId}
                disabled={!selectedGroupId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                className={`w-full h-11 bg-neutral-950 border rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-amber-500 ${
                  !selectedGroupId
                    ? 'border-neutral-850 text-neutral-600 cursor-not-allowed'
                    : 'border-neutral-800 text-white'
                }`}
              >
                {!selectedGroupId && <option value="">先にグループを選択してください</option>}
                {rules.map((r) => (
                  <option key={r.rule_id} value={r.rule_id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {selectedRuleId && (
                <button
                  type="button"
                  onClick={() => {
                    const r = rules.find((item) => item.rule_id === selectedRuleId);
                    if (r) setDetailModalRule(r);
                  }}
                  className="mt-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                >
                  ルール詳細を確認 &rarr;
                </button>
              )}
            </div>

            {/* 4桁PIN入力 */}
            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                引き継ぎ用4桁PIN番号
              </label>
              <input
                id="game-pin"
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={4}
                defaultValue="1234"
                placeholder="4桁の数字 (例: 1234)"
                className="w-full h-11 bg-neutral-950 border border-neutral-800 rounded-xl px-3 text-sm text-white font-mono font-bold tracking-widest focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 4名プレイヤー選択 (グループ絞り込み ＆ 重複除外) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-neutral-300">
                  対局者 (東・南・西・北の座順)
                </label>
                {selectedMembers.filter(Boolean).length === 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      // 時計回りに1席ローテーション: [東, 南, 西, 北] -> [南, 西, 北, 東]
                      setSelectedMembers(([e, s, w, n]) => [s, w, n, e]);
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline"
                    title="4名の座順を時計回りに1席ずらします"
                  >
                    席をローテーション
                  </button>
                )}
              </div>

              {!selectedGroupId ? (
                <div className="p-4 bg-neutral-950/60 rounded-xl border border-neutral-850 text-center text-xs text-neutral-500 font-bold">
                  対局グループを選択すると、メンバー選択肢が表示されます
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {['東家 (起家)', '南家', '西家', '北家'].map((seatLabel, idx) => {
                    const availableMembers = getAvailableMembersForSeat(idx);

                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[11px] text-neutral-400 font-bold">
                          {seatLabel}
                        </span>
                        <select
                          value={selectedMembers[idx]}
                          onChange={(e) => {
                            const next = [...selectedMembers];
                            next[idx] = e.target.value;
                            setSelectedMembers(next);
                          }}
                          className={`h-11 bg-neutral-950 border rounded-lg px-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 ${
                            selectedMembers[idx]
                              ? 'border-neutral-700 text-white'
                              : 'border-neutral-850 text-neutral-400'
                          }`}
                        >
                          <option value="">選択してください</option>
                          {availableMembers.map((m) => (
                            <option key={m.member_id} value={m.member_id}>
                              {m.member_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] font-semibold text-neutral-500">
              ※ 作成した端末が最初の「記録係」になります。他端末へは画面上の4桁PINでいつでも交代できます。
            </p>

            <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!isReadyToCreate}
                  onClick={handleStartSimpleGame}
                  className={`flex-1 h-12 rounded-xl text-xs font-black transition-all shadow-xs border ${
                    isReadyToCreate
                      ? 'bg-neutral-800 hover:bg-neutral-750 active:scale-[0.98] border-amber-500/60 text-amber-300'
                      : 'bg-neutral-950 text-neutral-600 border-neutral-850 cursor-not-allowed'
                  }`}
                >
                  結果のみ入力
                </button>
                <button
                  type="button"
                  disabled={creating || !isReadyToCreate}
                  onClick={handleCreateGame}
                  className={`flex-2 h-12 rounded-xl text-xs font-black shadow-md transition-all ${
                    isReadyToCreate && !creating
                      ? 'bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white'
                      : 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-750'
                  }`}
                >
                  {creating ? '作成中...' : '対局を作成して開始'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="w-full h-10 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-neutral-400 text-xs font-bold transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結果のみ入力モーダル */}
      <SimpleGameInputModal
        isOpen={showSimpleModal}
        onClose={() => setShowSimpleModal(false)}
        groupId={selectedGroupId === 'free' ? groups.find(g => g.display_id === 'free')?.group_id || groups[0]?.group_id : selectedGroupId}
        ruleName={rules.find((r) => r.rule_id === selectedRuleId)?.name || '標準ルール'}
        ruleConfig={((rules.find((r) => r.rule_id === selectedRuleId)?.config_json as unknown as RuleConfig) || {}) as RuleConfig}
        players={selectedMembers.map((mId, idx) => {
          const mem = members.find((m) => m.member_id === mId);
          return {
            seat: idx + 1,
            memberId: mId,
            playerName: mem?.member_name || `P${idx + 1}`,
          };
        })}
      />

      {/* 詳細ルール確認モーダル */}
      {detailModalRule && (
        <RuleDetailModal
          ruleName={detailModalRule.name}
          config={detailModalRule.config_json as unknown as RuleConfig}
          isOfficial={detailModalRule.kind === 'official'}
          onClose={() => setDetailModalRule(null)}
        />
      )}
    </main>
  );
}
