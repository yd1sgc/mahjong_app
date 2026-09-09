/**
 * ホーム画面：対局一覧 ＆ 新規対局開始
 * docs/DETAILED_DESIGN.md 準拠
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
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 新規対局モーダル用状態
  const [showNewGameModal, setShowNewGameModal] = useState(false);
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

        // (3) ルールテンプレート取得
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

  // 新規対局作成処理
  const handleCreateGame = async () => {
    const validMembers = selectedMembers.filter(Boolean);
    if (validMembers.length !== 4) {
      alert('4名のプレイヤーを選択してください');
      return;
    }
    // 重複チェック
    if (new Set(validMembers).size !== 4) {
      alert('同じプレイヤーが重複しています');
      return;
    }

    setCreating(true);
    try {
      const gameId = crypto.randomUUID();
      // ランダム4桁PIN生成
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const ruleObj = rules.find((r) => r.rule_id === selectedRuleId);
      const ruleName = ruleObj?.name || '標準ルール';
      const ruleConfig = ruleObj?.config_json || {};

      // 1. games レコード作成
      const { error: gErr } = await (supabase.from('games') as any).insert({
        game_id: gameId,
        group_id: 'default_group', // 初期グループ
        passcode: pin,
        rule_name_snapshot: ruleName,
        rule_config_snapshot: ruleConfig,
        status: 'in_progress',
        sync_target: 1,
        is_synced: 1,
      });

      if (gErr) throw new Error(gErr.message);

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

      if (pErr) throw new Error(pErr.message);

      // 3. この端末を記録係としてトークン保存
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mahjong_recorder_${gameId}`, pin);
      }

      // 対局画面へ遷移
      router.push(`/game?id=${gameId}`);
    } catch (e: any) {
      alert(`対局作成に失敗しました: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white max-w-md mx-auto p-4 flex flex-col gap-5">
      {/* アプリヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>🀄</span> 麻雀スコア管理
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            リアルタイム共有 Webアプリ (Cloudflare Pages)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewGameModal(true)}
          className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center touch-manipulation"
        >
          ＋ 新規対局
        </button>
      </header>

      {/* 進行中・過去の対局一覧 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-neutral-300 flex items-center justify-between">
          <span>対局一覧 ({games.length}件)</span>
          <span className="text-[11px] font-normal text-neutral-500">クラウド同期済</span>
        </h2>

        {loading ? (
          <div className="p-8 text-center text-neutral-500 text-xs">
            読み込み中...
          </div>
        ) : games.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-xs bg-neutral-900 rounded-xl border border-neutral-800">
            対局データがありません。「新規対局」から開始してください。
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {games.map((g) => (
              <Link
                key={g.game_id}
                href={`/game?id=${g.game_id}`}
                className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col gap-1.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-200">
                    {g.rule_name_snapshot}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      g.status === 'in_progress'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {g.status === 'in_progress' ? '対局中' : '終了'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{g.played_at?.slice(0, 16).replace('T', ' ')}</span>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    スコアを開く →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 新規対局モーダル */}
      {showNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-white">新規対局の開始</h3>
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* ルール選択 */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                対局ルール
              </label>
              <select
                value={selectedRuleId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                className="w-full h-11 bg-neutral-950 border border-neutral-800 rounded-xl px-3 text-sm text-white font-medium focus:outline-none focus:border-amber-500"
              >
                {rules.map((r) => (
                  <option key={r.rule_id} value={r.rule_id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4名プレイヤー選択 */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                対局者 (東・南・西・北の座順)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['東家 (起家)', '南家', '西家', '北家'].map((seatLabel, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-[11px] text-neutral-400 font-semibold">
                      {seatLabel}
                    </span>
                    <select
                      value={selectedMembers[idx]}
                      onChange={(e) => {
                        const next = [...selectedMembers];
                        next[idx] = e.target.value;
                        setSelectedMembers(next);
                      }}
                      className="h-10 bg-neutral-950 border border-neutral-800 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-amber-500"
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

            <p className="text-[11px] text-neutral-500">
              ※ 作成した端末が最初の「記録係」になります。他端末へは画面上の4桁PINでいつでも交代できます。
            </p>

            <div className="flex gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="flex-1 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateGame}
                className="flex-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all"
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
