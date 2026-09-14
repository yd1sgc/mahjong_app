/**
 * 対局ルール管理画面 (/manage/rules)
 * ルール一覧、公式ルール複製・カスタムルール新規作成、アーカイブ
 * 
 * モーダル表示ロジックは src/components/manage/RuleEditModal.tsx に分離
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RuleTemplateRow } from '@/types/database';
import { RuleDetailModal } from '@/components/RuleDetailModal';
import { RuleEditModal } from '@/components/manage/RuleEditModal';
import { RuleConfig } from '@/types/mahjong';

export default function RulesManagePage() {
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // 詳細確認モーダル状態
  const [detailModalRule, setDetailModalRule] = useState<RuleTemplateRow | null>(null);

  // ルール作成・編集モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalSourceRule, setModalSourceRule] = useState<RuleTemplateRow | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

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

  // 公式ルールから初期値をコピーして新規作成モーダルを開く
  const handleOpenDuplicate = (sourceRule: RuleTemplateRow) => {
    setModalSourceRule(sourceRule);
    setIsDuplicate(true);
    setShowCreateModal(true);
  };

  // 既存カスタムルールの編集モーダルを開く (バージョンv~ 自動付与)
  const handleOpenEdit = (targetRule: RuleTemplateRow) => {
    setModalSourceRule(targetRule);
    setIsDuplicate(false);
    setShowCreateModal(true);
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
    <main className="w-full min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-6">
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
              const cfg = (r.config_json || {}) as unknown as Partial<RuleConfig>;
              const basic = cfg.basic || {};
              const detail = cfg.detail || {};

              return (
                <div
                  key={r.rule_id}
                  className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border shrink-0 ${
                          r.kind === 'official'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        {r.kind === 'official' ? '公式ルール' : 'カスタム'}
                      </span>
                      <span className="text-base font-black text-white">
                        {r.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailModalRule(r)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-amber-300 border border-amber-500/30 transition-colors"
                      >
                        詳細確認
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDuplicate(r)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-neutral-300 transition-colors"
                      >
                        複製
                      </button>
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

      {/* ─── モーダル: ルール新規作成・編集 ─── */}
      <RuleEditModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setModalSourceRule(null);
        }}
        onSaved={loadRules}
        rules={rules}
        sourceRule={modalSourceRule}
        isDuplicate={isDuplicate}
      />

      {/* ─── 詳細確認モーダル ─── */}
      {detailModalRule && (
        <RuleDetailModal
          ruleName={detailModalRule.name}
          config={detailModalRule.config_json as unknown as RuleConfig}
          isOfficial={detailModalRule.kind === 'official'}
          onClose={() => setDetailModalRule(null)}
          onEdit={() => {
            const target = detailModalRule;
            setDetailModalRule(null);
            handleOpenEdit(target);
          }}
        />
      )}
    </main>
  );
}
