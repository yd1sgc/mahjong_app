/**
 * 統合管理画面（グループ・ルール・システム管理）
 * mahjong_personal 準拠：group_manage, rule_manage, data_manage の機能をモダンUIで統合
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RuleTemplateRow, MemberRow } from '@/types/database';

export default function ManagePage() {
  const [tab, setTab] = useState<'groups' | 'rules' | 'system'>('groups');
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [gamesCount, setGamesCount] = useState(0);
  const [roundsCount, setRoundsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadManageData() {
      try {
        setLoading(true);

        // 1. グループ取得
        const { data: grpData } = await supabase
          .from('groups')
          .select('*')
          .eq('is_archived', 0);
        if (grpData) setGroups(grpData);

        // 2. メンバー取得
        const { data: memData } = await supabase
          .from('members')
          .select('*')
          .eq('is_archived', 0)
          .order('member_name');
        if (memData) setMembers(memData);

        // 3. ルールテンプレート取得
        const { data: rData } = await supabase
          .from('rule_templates')
          .select('*')
          .eq('is_archived', 0);
        if (rData) setRules(rData as any);

        // 4. データ件数集計
        const { count: gCount } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true });
        if (gCount !== null) setGamesCount(gCount);

        const { count: rCount } = await supabase
          .from('rounds')
          .select('*', { count: 'exact', head: true });
        if (rCount !== null) setRoundsCount(rCount);
      } finally {
        setLoading(false);
      }
    }

    loadManageData();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-5">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            システム設定・管理
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            グループ / ルール / クラウドデータ管理
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-neutral-300 hover:text-white font-bold py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 transition-colors"
        >
          &larr; ホームへ戻る
        </Link>
      </header>

      {/* タブナビゲーション */}
      <nav className="grid grid-cols-3 gap-1.5 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
        {[
          { id: 'groups', label: 'グループ管理' },
          { id: 'rules', label: 'ルール管理' },
          { id: 'system', label: 'データ・同期' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as any)}
            className={`py-2 rounded-lg text-xs font-black transition-all ${
              tab === item.id
                ? 'bg-amber-500 text-black shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="p-12 text-center text-neutral-500 text-xs font-bold">
          管理データを読込中...
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* ─── グループ管理タブ ─── */}
          {tab === 'groups' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-300">
                  登録グループ一覧 ({groups.length}件)
                </span>
                <span className="text-[11px] font-bold text-neutral-500">
                  全メンバー: {members.length}名
                </span>
              </div>

              {groups.map((g) => (
                <div
                  key={g.group_id}
                  className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-white">
                      {g.group_name}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                      ID: {g.group_id}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-400">
                    <span className="font-bold text-neutral-500 block mb-1">
                      所属メンバー（{members.length}名登録中）:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => (
                        <span
                          key={m.member_id}
                          className="px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-[11px] font-bold text-neutral-300"
                        >
                          {m.member_name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── ルール管理タブ ─── */}
          {tab === 'rules' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-300">
                  対局ルールテンプレート ({rules.length}件)
                </span>
              </div>

              {rules.map((r) => {
                const cfg: any = r.config_json || {};
                const basic = cfg.basic || {};
                const detail = cfg.detail || {};

                return (
                  <div
                    key={r.rule_id}
                    className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-white">
                        {r.name}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {r.kind === 'official' ? '公式ルール' : 'カスタム'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-neutral-800">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-neutral-500">配給原点 / 返し点</span>
                        <span className="font-black text-neutral-200">
                          {basic.init_score ?? 25000}点 / {basic.return_score ?? 30000}点
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-neutral-500">順位ウマ</span>
                        <span className="font-black text-neutral-200">
                          {Array.isArray(basic.uma) ? basic.uma.join(', ') : '50, 10, -10, -30'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-neutral-500">連荘条件</span>
                        <span className="font-black text-neutral-200">
                          {detail.renchan_rule === 'tenpai' ? 'テンパイ連荘' : '和了連荘'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-neutral-500">飛び終了</span>
                        <span className="font-black text-neutral-200">
                          {detail.tobi_end === 'under_zero' ? '0点未満で終了' : 'トビなし'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── データ・同期タブ ─── */}
          {tab === 'system' && (
            <div className="flex flex-col gap-3">
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs">
                <span className="text-sm font-black text-white">
                  クラウド同期ステータス
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">総対局数</span>
                    <span className="text-base font-black text-amber-300">
                      {gamesCount} 戦
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">総記録局数</span>
                    <span className="text-base font-black text-cyan-300">
                      {roundsCount} 局
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">登録メンバー</span>
                    <span className="text-base font-black text-neutral-200">
                      {members.length} 名
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-400">Supabase 接続</span>
                  <span className="font-black text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    正常稼働中
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
