/**
 * ホーム画面：対局開始・中断再開・成績・管理導線
 * mahjong_personal 準拠：中断対局の自動検知バナー・目的別大ボタン・絵文字なし
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GameRow, MemberRow, RuleTemplateRow } from '@/types/database';

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<GameRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 新規対局モーダル用状態
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['', '', '', '']);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // (1) 直近対局取得
        const { data: gData } = await supabase
          .from('games')
          .select('*')
          .order('played_at', { ascending: false })
          .limit(30);

        if (gData) setGames(gData);

        // (2) メンバー取得
        const { data: mData } = await supabase
          .from('members')
          .select('*')
          .eq('is_archived', 0)
          .order('member_name');

        if (mData) setMembers(mData);

        // (3) グループ取得
        const { data: grpData } = await supabase
          .from('groups')
          .select('*')
          .eq('is_archived', 0);

        if (grpData && grpData.length > 0) {
          setGroups(grpData);
          const defaultGrp: any =
            grpData.find((g: any) => g.group_name.includes('親族')) || grpData[0];
          if (defaultGrp?.group_id) {
            setSelectedGroupId(defaultGrp.group_id);
          }
        }

        // (4) ルールテンプレート取得
        const { data: rData } = await supabase
          .from('rule_templates')
          .select('*')
          .eq('is_archived', 0);

        if (rData && rData.length > 0) {
          setRules(rData as any);
          setSelectedRuleId((rData as any)[0].rule_id);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 進行中の対局を検知
  const activeGame = games.find((g) => g.status === 'in_progress');

  // 新規対局作成処理
  const handleCreateGame = async () => {
    const validMembers = selectedMembers.filter(Boolean);
    if (validMembers.length !== 4) {
      alert('4名のプレイヤーを選択してください');
      return;
    }
    // 重複チェック
    if (new Set(validMembers).size !== 4) {
      alert('プレイヤーが重複しています。異なる4名を選択してください');
      return;
    }

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

      // 1. games レコード作成
      const { error: gErr } = await (supabase.from('games') as any).insert({
        game_id: gameId,
        group_id: selectedGroupId || groups[0]?.group_id,
        passcode: pin,
        rule_name_snapshot: ruleName,
        rule_config_snapshot: ruleConfig,
        status: 'in_progress',
        sync_target: 1,
        is_synced: 1,
      });

      if (gErr) {
        console.error('games insert error:', gErr);
        throw new Error(gErr.message || JSON.stringify(gErr));
      }

      // 2. game_participants 作成
      const participants = validMembers.map((mId, idx) => {
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

      const { error: pErr } = await (supabase
        .from('game_participants') as any)
        .insert(participants);

      if (pErr) {
        console.error('game_participants insert error:', pErr);
        throw new Error(pErr.message || JSON.stringify(pErr));
      }

      // 3. この端末を記録係としてトークン保存
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mahjong_recorder_${gameId}`, pin);
      }

      // 対局画面へ遷移
      router.push(`/game?id=${gameId}`);
    } catch (e: any) {
      console.error(e);
      alert(`対局作成に失敗しました: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-5">
      {/* アプリヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            麻雀スコア管理
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            クラウド同期 Webシステム
          </p>
        </div>
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
          onClick={() => setShowNewGameModal(true)}
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
              <h3 className="text-base font-black text-white">新規対局の開始</h3>
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* グループ選択 */}
            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局グループ
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full h-11 bg-neutral-950 border border-neutral-800 rounded-xl px-3 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
              >
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {g.group_name}
                  </option>
                ))}
              </select>
            </div>

            {/* ルール選択 */}
            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局ルール
              </label>
              <select
                value={selectedRuleId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                className="w-full h-11 bg-neutral-950 border border-neutral-800 rounded-xl px-3 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
              >
                {rules.map((r) => (
                  <option key={r.rule_id} value={r.rule_id}>
                    {r.name}
                  </option>
                ))}
              </select>
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

            {/* 4名プレイヤー選択 */}
            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局者 (東・南・西・北の座順)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['東家 (起家)', '南家', '西家', '北家'].map((seatLabel, idx) => (
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
                      className="h-11 bg-neutral-950 border border-neutral-800 rounded-lg px-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">選択してください</option>
                      {members.map((m) => (
                        <option key={m.member_id} value={m.member_id}>
                          {m.member_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] font-semibold text-neutral-500">
              ※ 作成した端末が最初の「記録係」になります。他端末へは画面上の4桁PINでいつでも交代できます。
            </p>

            <div className="flex gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="flex-1 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateGame}
                className="flex-2 h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md transition-all"
              >
                {creating ? '作成中...' : '対局を作成して開始'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

