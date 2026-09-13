/**
 * グループ・メンバー管理画面 (/manage/groups)
 * メンバーCRUD（追加・名前変更・アーカイブ・復元）およびグループCRUD
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MemberRow, GroupRow, RuleTemplateRow } from '@/types/database';

interface GroupMembership {
  group_id: string;
  member_id: string;
}

export default function GroupsManagePage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMembersList, setShowMembersList] = useState(false);
  const [showArchivedMembers, setShowArchivedMembers] = useState(false);

  // メンバー追加モーダル
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberIsGuest, setNewMemberIsGuest] = useState(false);
  const [submittingMember, setSubmittingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // メンバー総合編集モーダル
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberIsGuest, setEditMemberIsGuest] = useState(false);
  const [editMemberGroupIds, setEditMemberGroupIds] = useState<string[]>([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // グループ作成モーダル
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // データ読込
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. 全メンバー取得（アーカイブ含む）
      const { data: memData } = await supabase
        .from('members')
        .select('*')
        .order('member_name');
      if (memData) setMembers(memData);

      // 2. 有効グループ取得
      const { data: grpData } = await supabase
        .from('groups')
        .select('*')
        .eq('is_archived', 0);
      if (grpData) setGroups(grpData);

      // 3. グループメンバーシップ取得
      const { data: gmData } = await supabase
        .from('group_memberships')
        .select('group_id, member_id');
      if (gmData) setGroupMemberships(gmData as GroupMembership[]);

      // 4. ルール取得（グループ作成用）
      const { data: rData } = await supabase
        .from('rule_templates')
        .select('*')
        .eq('is_archived', 0);
      if (rData) {
        setRules(rData);
        if (rData.length > 0 && !selectedRuleId) {
          setSelectedRuleId(rData[0].rule_id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRuleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 有効メンバーとアーカイブ済みメンバーの分離
  const activeMembers = members.filter((m) => m.is_archived === 0);
  const archivedMembers = members.filter((m) => m.is_archived === 1);

  // 1. 新規メンバー登録
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setMemberError('メンバー名を入力してください');
      return;
    }

    if (members.some((m) => m.member_name.toLowerCase() === trimmed.toLowerCase())) {
      setMemberError('同名のメンバーが既に登録されています');
      return;
    }

    try {
      setSubmittingMember(true);
      setMemberError(null);

      const { error } = await supabase.from('members').insert({
        member_id: crypto.randomUUID(),
        member_name: trimmed,
        is_guest: newMemberIsGuest ? 1 : 0,
        is_archived: 0,
      });

      if (error) throw new Error(error.message);

      setNewMemberName('');
      setNewMemberIsGuest(false);
      setShowAddMemberModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登録に失敗しました';
      setMemberError(msg);
    } finally {
      setSubmittingMember(false);
    }
  };

  // 2. メンバー編集モーダルを開く
  const openEditModal = (member: MemberRow) => {
    setEditingMember(member);
    setEditMemberName(member.member_name);
    setEditMemberIsGuest(member.is_guest === 1);
    const currentGroups = groupMemberships
      .filter((gm) => gm.member_id === member.member_id)
      .map((gm) => gm.group_id);
    setEditMemberGroupIds(currentGroups);
    setEditError(null);
  };

  // 3. メンバー編集の保存（名前・ゲスト設定・所属グループ）
  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    const trimmed = editMemberName.trim();
    if (!trimmed) {
      setEditError('メンバー名を入力してください');
      return;
    }

    if (
      members.some(
        (m) =>
          m.member_id !== editingMember.member_id &&
          m.member_name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setEditError('同名のメンバーが既に登録されています');
      return;
    }

    try {
      setSubmittingEdit(true);
      setEditError(null);

      // (1) members テーブル更新 (名前、ゲストフラグ)
      const { error: memErr } = await supabase
        .from('members')
        .update({
          member_name: trimmed,
          is_guest: editMemberIsGuest ? 1 : 0,
        })
        .eq('member_id', editingMember.member_id);

      if (memErr) throw new Error(memErr.message);

      // (2) group_memberships テーブル同期
      // 既存の所属を削除
      const { error: delErr } = await supabase
        .from('group_memberships')
        .delete()
        .eq('member_id', editingMember.member_id);

      if (delErr) throw new Error(delErr.message);

      // 選択されたグループがあれば一括登録
      if (editMemberGroupIds.length > 0) {
        const inserts = editMemberGroupIds.map((gId) => ({
          group_id: gId,
          member_id: editingMember.member_id,
        }));
        const { error: insErr } = await supabase
          .from('group_memberships')
          .insert(inserts);

        if (insErr) throw new Error(insErr.message);
      }

      setEditingMember(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新に失敗しました';
      setEditError(msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // 4. 編集モーダル内からのアーカイブ（非表示化）
  const handleArchiveFromModal = async () => {
    if (!editingMember) return;
    if (
      !confirm(
        `「${editingMember.member_name}」を非表示（アーカイブ）にしますか？\n過去の対局成績は保持されます。`
      )
    ) {
      return;
    }

    try {
      setSubmittingEdit(true);
      const { error } = await supabase
        .from('members')
        .update({ is_archived: 1 })
        .eq('member_id', editingMember.member_id);

      if (error) throw new Error(error.message);

      setEditingMember(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'アーカイブに失敗しました';
      alert(msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // 3. メンバーアーカイブ（論理削除）
  const handleArchiveMember = async (member: MemberRow) => {
    if (!confirm(`「${member.member_name}」をアーカイブ（非表示）にしますか？\n過去の対局成績は保持されます。`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('members')
        .update({ is_archived: 1 })
        .eq('member_id', member.member_id);

      if (error) throw new Error(error.message);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'アーカイブに失敗しました';
      alert(msg);
    }
  };

  // 4. メンバー復元
  const handleRestoreMember = async (member: MemberRow) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ is_archived: 0 })
        .eq('member_id', member.member_id);

      if (error) throw new Error(error.message);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '復元に失敗しました';
      alert(msg);
    }
  };

  // 5. 新規グループ作成
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setGroupError('グループ名を入力してください');
      return;
    }
    if (!selectedRuleId) {
      setGroupError('デフォルトルールを選択してください');
      return;
    }

    try {
      setSubmittingGroup(true);
      setGroupError(null);

      const newGroupId = crypto.randomUUID();
      const displayId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'grp';

      // (1) groups レコード作成
      const { error: gErr } = await supabase.from('groups').insert({
        group_id: newGroupId,
        display_id: displayId,
        group_name: trimmed,
        default_rule_id: selectedRuleId,
        is_archived: 0,
      });

      if (gErr) throw new Error(gErr.message);

      // (2) group_memberships レコード作成
      if (selectedMemberIds.length > 0) {
        const memberships = selectedMemberIds.map((mId) => ({
          group_id: newGroupId,
          member_id: mId,
        }));
        const { error: mErr } = await supabase.from('group_memberships').insert(memberships);
        if (mErr) throw new Error(mErr.message);
      }

      setNewGroupName('');
      setSelectedMemberIds([]);
      setShowAddGroupModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'グループ作成に失敗しました';
      setGroupError(msg);
    } finally {
      setSubmittingGroup(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-6">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            グループ・メンバー管理
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            対局参加メンバーおよびグループの登録・変更
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-neutral-300 hover:text-white font-bold py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 transition-colors"
        >
          &larr; ホームへ
        </Link>
      </header>

      {loading ? (
        <div className="p-12 text-center text-neutral-500 text-xs font-bold">
          データを読込中...
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ─── セクション1: メンバー管理 ─── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">
                  プレイヤーメンバー
                </h2>
                <span className="text-xs font-bold text-neutral-400">
                  登録済み: {activeMembers.length}名
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMemberError(null);
                  setNewMemberName('');
                  setNewMemberIsGuest(false);
                  setShowAddMemberModal(true);
                }}
                className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-black text-xs transition-all shadow-xs"
              >
                + メンバーを追加
              </button>
            </div>

            {/* アコーディオン開閉トグルボタン */}
            <button
              type="button"
              onClick={() => setShowMembersList(!showMembersList)}
              className="w-full p-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 flex items-center justify-between transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">
                  メンバー一覧 ({activeMembers.length}名)
                </span>
                <span className="text-[11px] font-bold text-neutral-400">
                  {showMembersList ? '折りたたむ' : '展開して表示・編集'}
                </span>
              </div>
              <span className="text-xs font-black text-amber-500">
                {showMembersList ? '▲ 閉じる' : '▼ 表示する'}
              </span>
            </button>

            {/* 有効メンバー一覧 (アコーディオン開閉) */}
            {showMembersList && (
              <div className="flex flex-col gap-2">
                {activeMembers.length === 0 ? (
                  <div className="p-6 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-850">
                    登録されているメンバーはいません。「+ メンバーを追加」から登録してください。
                  </div>
                ) : (
                  activeMembers.map((m) => {
                    // このメンバーが所属している通常グループ一覧
                    const memberGroupNames = groupMemberships
                      .filter((gm) => gm.member_id === m.member_id)
                      .map((gm) => groups.find((g) => g.group_id === gm.group_id))
                      .filter(
                        (g): g is GroupRow =>
                          Boolean(g) &&
                          g!.display_id !== 'free' &&
                          g!.group_name !== 'フリー対局'
                      )
                      .map((g) => g.group_name);

                    return (
                      <div
                        key={m.member_id}
                        className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between shadow-xs gap-2"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white truncate">
                              {m.member_name}
                            </span>
                            {m.is_guest === 1 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 shrink-0">
                                ゲスト
                              </span>
                            )}
                          </div>

                          {/* 所属グループバッジ */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {memberGroupNames.length > 0 ? (
                              memberGroupNames.map((name) => (
                                <span
                                  key={name}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] font-bold text-neutral-500">
                                未所属
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="shrink-0 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-black text-white transition-colors"
                        >
                          編集
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* アーカイブ済みメンバー（アコーディオン） */}
            {archivedMembers.length > 0 && (
              <div className="pt-2 border-t border-neutral-900 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchivedMembers(!showArchivedMembers)}
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-400 flex items-center justify-between py-1"
                >
                  <span>非表示・アーカイブ済み ({archivedMembers.length}名)</span>
                  <span>{showArchivedMembers ? '▲ 閉じる' : '▼ 表示'}</span>
                </button>

                {showArchivedMembers && (
                  <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-neutral-800">
                    {archivedMembers.map((m) => (
                      <div
                        key={m.member_id}
                        className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-neutral-500 line-through">
                          {m.member_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestoreMember(m)}
                          className="px-2 py-0.5 rounded bg-neutral-850 hover:bg-neutral-800 text-[10px] font-black text-amber-400 transition-colors"
                        >
                          復元する
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ─── セクション2: グループ管理 ─── */}
          <section className="flex flex-col gap-3 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">
                  対局グループ
                </h2>
                <span className="text-xs font-bold text-neutral-400">
                  登録グループ: {groups.length}件
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGroupError(null);
                  setNewGroupName('');
                  setSelectedMemberIds([]);
                  setShowAddGroupModal(true);
                }}
                className="py-2 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-neutral-200 font-black text-xs transition-all border border-neutral-700 shadow-xs"
              >
                + グループを作成
              </button>
            </div>

            {/* グループ一覧 */}
            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <div
                  key={g.group_id}
                  className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-white">
                      {g.group_name}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                      ID: {g.display_id}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-400">
                    <span className="font-bold text-neutral-500 block mb-1">
                      全登録メンバー（{activeMembers.length}名）が利用可能
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ─── モーダル: メンバー追加 ─── */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="text-base font-black text-white">
              新規メンバー追加
            </h3>

            {memberError && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-bold">
                {memberError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400">
                  メンバー名（表示名）
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="例: 佐藤"
                  className="w-full h-11 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-bold text-sm focus:outline-hidden focus:border-amber-500"
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newMemberIsGuest}
                  onChange={(e) => setNewMemberIsGuest(e.target.checked)}
                  className="w-4 h-4 rounded-sm bg-neutral-950 border-neutral-700 text-amber-500 focus:ring-0"
                />
                <span className="text-xs font-bold text-neutral-300">
                  外部参加者（ゲスト・臨時メンバー）
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submittingMember || !newMemberName.trim()}
                  className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs transition-all shadow-xs"
                >
                  {submittingMember ? '保存中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── モーダル: メンバー総合編集 ─── */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-base font-black text-white">メンバー編集</h3>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="text-neutral-400 hover:text-white text-base font-bold px-1"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-bold">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveMemberEdit} className="flex flex-col gap-4">
              {/* メンバー名 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400">
                  メンバー名（表示名）
                </label>
                <input
                  type="text"
                  value={editMemberName}
                  onChange={(e) => setEditMemberName(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-bold text-sm focus:outline-hidden focus:border-amber-500"
                  autoFocus
                />
              </div>

              {/* 外部参加者（ゲスト）設定 */}
              <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-colors">
                <input
                  type="checkbox"
                  checked={editMemberIsGuest}
                  onChange={(e) => setEditMemberIsGuest(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-sm bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-0"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-neutral-200">
                    外部参加者（ゲスト・臨時メンバー）
                  </span>
                  <span className="text-[10px] font-bold text-neutral-500 leading-tight">
                    ※チェックを外して所属グループを設定すると、過去にゲストとして打った試合も含めて正規メンバー成績に合算されます
                  </span>
                </div>
              </label>

              {/* 所属グループ選択 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400">
                  所属グループの選択（複数選択可）
                </label>
                {groups.filter(
                  (g) => g.display_id !== 'free' && g.group_name !== 'フリー対局'
                ).length === 0 ? (
                  <div className="text-xs text-neutral-500 p-3 bg-neutral-950 rounded-xl border border-neutral-850">
                    登録されているグループはありません
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                    {groups
                      .filter(
                        (g) =>
                          g.display_id !== 'free' && g.group_name !== 'フリー対局'
                      )
                      .map((g) => {
                        const isChecked = editMemberGroupIds.includes(g.group_id);
                        return (
                          <label
                            key={g.group_id}
                            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-neutral-900 cursor-pointer text-xs font-bold text-neutral-200"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditMemberGroupIds((prev) => [
                                    ...prev,
                                    g.group_id,
                                  ]);
                                } else {
                                  setEditMemberGroupIds((prev) =>
                                    prev.filter((id) => id !== g.group_id)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded-sm bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-0"
                            />
                            <span>{g.group_name}</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* ボタン群: 保存 / キャンセル */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit || !editMemberName.trim()}
                  className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs transition-all shadow-xs"
                >
                  {submittingEdit ? '保存中...' : '変更を保存'}
                </button>
              </div>

              {/* 非表示（アーカイブ）化ボタン */}
              <div className="pt-3 border-t border-neutral-800 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleArchiveFromModal}
                  disabled={submittingEdit}
                  className="w-full h-10 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-rose-900/60 hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400 text-xs font-bold transition-colors"
                >
                  このメンバーを非表示にする
                </button>
                <span className="text-[10px] text-neutral-500 text-center font-bold">
                  ※過去の対局成績は保持され、いつでも復元できます
                </span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── モーダル: グループ作成 ─── */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="text-base font-black text-white">
              新規グループ作成
            </h3>

            {groupError && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-bold">
                {groupError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400">
                  グループ名
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="例: 親族麻雀部"
                  className="w-full h-11 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-bold text-sm focus:outline-hidden focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400">
                  デフォルト対局ルール
                </label>
                <select
                  value={selectedRuleId}
                  onChange={(e) => setSelectedRuleId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                >
                  {rules.map((r) => (
                    <option key={r.rule_id} value={r.rule_id}>
                      {r.name} ({r.kind === 'official' ? '公式' : 'カスタム'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submittingGroup || !newGroupName.trim()}
                  className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs transition-all shadow-xs"
                >
                  {submittingGroup ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
