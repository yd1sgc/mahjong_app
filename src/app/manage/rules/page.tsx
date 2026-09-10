/**
 * 対局ルール管理画面 (/manage/rules)
 * ルール一覧、公式ルール複製・カスタムルール新規作成、アーカイブ
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RuleTemplateRow } from '@/types/database';

export default function RulesManagePage() {
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // ルール作成モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [initScore, setInitScore] = useState(25000);
  const [returnScore, setReturnScore] = useState(30000);
  const [uma1, setUma1] = useState(50);
  const [uma2, setUma2] = useState(10);
  const [uma3, setUma3] = useState(-10);
  const [uma4, setUma4] = useState(-30);
  const [renchanRule, setRenchanRule] = useState<'tenpai' | 'agari'>('tenpai');
  const [tobiEnd, setTobiEnd] = useState<'under_zero' | 'none'>('under_zero');
  const [suddenDeath, setSuddenDeath] = useState<'west' | 'none'>('west');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // データ読込
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('rule_templates')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setRules(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const activeRules = rules.filter((r) => r.is_archived === 0);
  const archivedRules = rules.filter((r) => r.is_archived === 1);

  // 公式ルールから初期値をコピーしてモーダルを開く
  const handleOpenDuplicate = (sourceRule: RuleTemplateRow) => {
    const cfg = (sourceRule.config_json || {}) as any;
    const basic = cfg.basic || {};
    const detail = cfg.detail || {};

    setRuleName(`${sourceRule.name} (カスタム)`);
    setInitScore(basic.init_score ?? 25000);
    setReturnScore(basic.return_score ?? 30000);

    const uma = Array.isArray(basic.uma) ? basic.uma : [50, 10, -10, -30];
    setUma1(uma[0] ?? 50);
    setUma2(uma[1] ?? 10);
    setUma3(uma[2] ?? -10);
    setUma4(uma[3] ?? -30);

    setRenchanRule(detail.renchan_rule === 'agari' ? 'agari' : 'tenpai');
    setTobiEnd(detail.tobi_end === 'none' ? 'none' : 'under_zero');
    setSuddenDeath(detail.sudden_death === 'none' ? 'none' : 'west');

    setFormError(null);
    setShowCreateModal(true);
  };

  // ルール新規保存
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ruleName.trim();
    if (!trimmed) {
      setFormError('ルール名を入力してください');
      return;
    }

    if (initScore > returnScore) {
      setFormError('返し点は配給原点以上である必要があります');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const configJson = {
        basic: {
          init_score: initScore,
          return_score: returnScore,
          uma: [uma1, uma2, uma3, uma4],
          uma_type: 'custom',
        },
        detail: {
          renchan_rule: renchanRule,
          tobi_end: tobiEnd,
          sudden_death: suddenDeath,
          agari_yame: 'top_end',
          honba_pt: 300,
          riichi_pt: 1000,
          chombo_pt: 20000,
        },
      };

      const { error } = await supabase.from('rule_templates').insert({
        rule_id: crypto.randomUUID(),
        name: trimmed,
        kind: 'custom',
        version: 1,
        config_json: configJson,
        is_archived: 0,
      });

      if (error) throw new Error(error.message);

      setShowCreateModal(false);
      await loadRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ルール作成に失敗しました';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // カスタムルールのアーカイブ
  const handleArchiveRule = async (rule: RuleTemplateRow) => {
    if (rule.kind === 'official') {
      alert('公式ルールは非表示にできません');
      return;
    }
    if (!confirm(`「${rule.name}」を非表示（アーカイブ）にしますか？\n過去の対局データには影響しません。`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('rule_templates')
        .update({ is_archived: 1 })
        .eq('rule_id', rule.rule_id);

      if (error) throw new Error(error.message);
      await loadRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'アーカイブに失敗しました';
      alert(msg);
    }
  };

  // 復元
  const handleRestoreRule = async (rule: RuleTemplateRow) => {
    try {
      const { error } = await supabase
        .from('rule_templates')
        .update({ is_archived: 0 })
        .eq('rule_id', rule.rule_id);

      if (error) throw new Error(error.message);
      await loadRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '復元に失敗しました';
      alert(msg);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-6">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            対局ルール管理
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            配給原点・返し点・ウマ・連荘・飛び賞の設定
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
          ルールデータを読込中...
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-neutral-400">
              登録ルール一覧 ({activeRules.length}件)
            </span>

            {activeRules.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenDuplicate(activeRules[0])}
                className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-black text-xs transition-all shadow-xs"
              >
                + 公式を複製して新規作成
              </button>
            )}
          </div>

          {/* ルールカード一覧 */}
          <div className="flex flex-col gap-3">
            {activeRules.map((r) => {
              const cfg = (r.config_json || {}) as any;
              const basic = cfg.basic || {};
              const detail = cfg.detail || {};

              return (
                <div
                  key={r.rule_id}
                  className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white">
                        {r.name}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          r.kind === 'official'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        {r.kind === 'official' ? '公式ルール' : 'カスタム'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDuplicate(r)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-neutral-300 transition-colors"
                      >
                        複製
                      </button>
                      {r.kind === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleArchiveRule(r)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-[11px] font-bold text-neutral-400 hover:text-rose-400 transition-colors"
                        >
                          非表示
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-neutral-800">
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

          {/* アーカイブ済みルール */}
          {archivedRules.length > 0 && (
            <div className="pt-2 border-t border-neutral-900 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-400 flex items-center justify-between py-1"
              >
                <span>非表示・アーカイブ済み ({archivedRules.length}件)</span>
                <span>{showArchived ? '▲ 閉じる' : '▼ 表示'}</span>
              </button>

              {showArchived && (
                <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-neutral-800">
                  {archivedRules.map((r) => (
                    <div
                      key={r.rule_id}
                      className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-neutral-500 line-through">
                        {r.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestoreRule(r)}
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
        </div>
      )}

      {/* ─── モーダル: ルール新規作成（複製） ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl my-8">
            <h3 className="text-base font-black text-white">
              カスタムルールの作成
            </h3>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400">
                  ルール名
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="例: 親族ルール（飛びなし）"
                  className="w-full h-11 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-bold text-sm focus:outline-hidden focus:border-amber-500"
                  autoFocus
                />
              </div>

              {/* 原点 / 返し点 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    配給原点
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={initScore}
                    onChange={(e) => setInitScore(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    返し点
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={returnScore}
                    onChange={(e) => setReturnScore(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
              </div>

              {/* 順位ウマ */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  順位ウマ（1位〜4位）
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <input
                    type="number"
                    value={uma1}
                    onChange={(e) => setUma1(Number(e.target.value))}
                    className="h-9 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                  <input
                    type="number"
                    value={uma2}
                    onChange={(e) => setUma2(Number(e.target.value))}
                    className="h-9 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                  <input
                    type="number"
                    value={uma3}
                    onChange={(e) => setUma3(Number(e.target.value))}
                    className="h-9 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                  <input
                    type="number"
                    value={uma4}
                    onChange={(e) => setUma4(Number(e.target.value))}
                    className="h-9 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
              </div>

              {/* 連荘条件 */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  連荘条件
                </label>
                <select
                  value={renchanRule}
                  onChange={(e) => setRenchanRule(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                >
                  <option value="tenpai">テンパイ連荘</option>
                  <option value="agari">和了連荘（アガリのみ）</option>
                </select>
              </div>

              {/* 飛び終了 */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  飛び終了
                </label>
                <select
                  value={tobiEnd}
                  onChange={(e) => setTobiEnd(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                >
                  <option value="under_zero">0点未満で終了（トビあり）</option>
                  <option value="none">トビなし（マイナス続行）</option>
                </select>
              </div>

              {/* サドンデス */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  南4局終了時（サドンデス）
                </label>
                <select
                  value={suddenDeath}
                  onChange={(e) => setSuddenDeath(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                >
                  <option value="west">西入あり（トップが返し点未満の場合）</option>
                  <option value="none">西入なし（南4局で必ず終了）</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting || !ruleName.trim()}
                  className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs transition-all shadow-xs"
                >
                  {submitting ? '保存中...' : 'ルールを保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
