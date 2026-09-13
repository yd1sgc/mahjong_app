/**
 * 対局ルール管理画面 (/manage/rules)
 * ルール一覧、公式ルール複製・カスタムルール新規作成、アーカイブ
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RuleTemplateRow } from '@/types/database';
import { RuleDetailModal } from '@/components/RuleDetailModal';

/** ルール名の次期バージョン名生成 (例: "親族ルール" -> "親族ルール (v2)", "親族ルール (v2)" -> "親族ルール (v3)") */
function getNextVersionName(currentName: string): string {
  const match = currentName.match(/^(.*?)\s*\(v(\d+)\)$/);
  if (match) {
    const base = match[1];
    const nextVer = parseInt(match[2], 10) + 1;
    return `${base} (v${nextVer})`;
  }
  return `${currentName} (v2)`;
}

export default function RulesManagePage() {
  const [rules, setRules] = useState<RuleTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // 詳細確認モーダル状態
  const [detailModalRule, setDetailModalRule] = useState<RuleTemplateRow | null>(null);

  // ルール作成・編集モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'flow' | 'rules' | 'notes'>('basic');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // タブ1: 基本設定
  const [ruleName, setRuleName] = useState('');
  const [gameLength, setGameLength] = useState<'hanchan' | 'tonpu'>('hanchan');
  const [initScore, setInitScore] = useState(25000);
  const [returnScore, setReturnScore] = useState(30000);
  const [uma1, setUma1] = useState(50);
  const [uma2, setUma2] = useState(10);
  const [uma3, setUma3] = useState(-10);
  const [uma4, setUma4] = useState(-30);
  const [renchanRule, setRenchanRule] = useState<'tenpai' | 'agari'>('tenpai');
  const [tobiEnd, setTobiEnd] = useState<'under_zero' | 'zero_or_less' | 'none'>('under_zero');
  const [suddenDeath, setSuddenDeath] = useState<'west' | 'none'>('west');
  const [agariYame, setAgariYame] = useState(true);
  const [tenpaiYame, setTenpaiYame] = useState(true);

  // タブ2: 点数・進行
  const [notenBappuPt, setNotenBappuPt] = useState(3000);
  const [honbaPt, setHonbaPt] = useState(300);
  const [riichiPt, setRiichiPt] = useState(1000);
  const [chomboRule, setChomboRule] = useState<'mangan_pay' | 'pt_penalty' | 'agari_hoki'>('mangan_pay');
  const [chomboPt, setChomboPt] = useState(20);
  const [dubron, setDubron] = useState<'atama_hane_kyotaku' | 'atama_hane' | 'split'>('atama_hane_kyotaku');
  const [kyushu, setKyushu] = useState<'renchan' | 'ryukyoku' | 'none'>('renchan');

  // タブ3: 手役・取り決め
  const [kuitan, setKuitan] = useState(true);
  const [akaDora, setAkaDora] = useState('3枚');
  const [atozuke, setAtozuke] = useState(true);
  const [kuikae, setKuikae] = useState<'prohibited' | 'allowed'>('prohibited');
  const [kiriageMangan, setKiriageMangan] = useState(false);
  const [ippatsuDora, setIppatsuDora] = useState(true);
  const [nagashiMangan, setNagashiMangan] = useState(false);
  const [pao, setPao] = useState(true);
  const [yakumanMultiple, setYakumanMultiple] = useState(true);
  const [kokushiAnkanWin, setKokushiAnkanWin] = useState(true);
  const [furitenTsumo, setFuritenTsumo] = useState(true);
  const [tsumobanNoneRiichi, setTsumobanNoneRiichi] = useState(false);
  const [wareme, setWareme] = useState(false);

  // タブ4: メモ・端数
  const [roundingType, setRoundingType] = useState('五捨六入');
  const [rateNote, setRateNote] = useState('');
  const [houseNotes, setHouseNotes] = useState('');

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

  // フォームへのルール値ロード共通関数
  const populateForm = (sourceRule: RuleTemplateRow, isDuplicate: boolean) => {
    const cfg = (sourceRule.config_json || {}) as Record<string, unknown>;
    const basic = (cfg.basic || cfg || {}) as Record<string, unknown>;
    const detail = (cfg.detail || {}) as Record<string, unknown>;

    if (isDuplicate) {
      setEditingRuleId(null);
      setRuleName(`${sourceRule.name} (カスタム)`);
    } else {
      setEditingRuleId(sourceRule.rule_id);
      setRuleName(getNextVersionName(sourceRule.name));
    }

    // 基本設定
    setGameLength(basic.game_length === 'tonpu' ? 'tonpu' : 'hanchan');
    setInitScore(typeof basic.init_score === 'number' ? basic.init_score : 25000);
    setReturnScore(typeof basic.return_score === 'number' ? basic.return_score : 30000);
    const uma = Array.isArray(basic.uma) ? basic.uma : [50, 10, -10, -30];
    setUma1(Number(uma[0] ?? 50));
    setUma2(Number(uma[1] ?? 10));
    setUma3(Number(uma[2] ?? -10));
    setUma4(Number(uma[3] ?? -30));
    setRenchanRule(detail.renchan_rule === 'agari' ? 'agari' : 'tenpai');
    setTobiEnd(
      detail.tobi_end === 'none'
        ? 'none'
        : detail.tobi_end === 'zero_or_less'
        ? 'zero_or_less'
        : 'under_zero'
    );
    setSuddenDeath(
      detail.sudden_death === 'none' || detail.west_extension === 'none' ? 'none' : 'west'
    );
    setAgariYame(detail.agari_yame !== false && detail.agari_yame !== 'none');
    setTenpaiYame(detail.tenpai_yame !== false && detail.tenpai_yame !== 'none');

    // 点数・進行
    setNotenBappuPt(typeof detail.noten_bappu_pt === 'number' ? detail.noten_bappu_pt : 3000);
    setHonbaPt(typeof detail.honba_pt === 'number' ? detail.honba_pt : 300);
    setRiichiPt(typeof detail.riichi_pt === 'number' ? detail.riichi_pt : 1000);
    setChomboRule(
      detail.chombo_rule === 'pt_penalty'
        ? 'pt_penalty'
        : detail.chombo_rule === 'agari_hoki'
        ? 'agari_hoki'
        : 'mangan_pay'
    );
    setChomboPt(typeof detail.chombo_pt === 'number' ? detail.chombo_pt : 20);
    setDubron(
      detail.dubron === 'atama_hane'
        ? 'atama_hane'
        : detail.dubron === 'split'
        ? 'split'
        : 'atama_hane_kyotaku'
    );
    setKyushu(
      detail.kyushu === 'ryukyoku'
        ? 'ryukyoku'
        : detail.kyushu === 'none'
        ? 'none'
        : 'renchan'
    );

    // 手役・取り決め
    setKuitan(detail.kuitan !== false);
    setAkaDora(typeof detail.aka_dora === 'string' ? detail.aka_dora : '3枚');
    setAtozuke(detail.atozuke !== false);
    setKuikae(detail.kuikae === 'allowed' ? 'allowed' : 'prohibited');
    setKiriageMangan(!!detail.kiriage_mangan);
    setIppatsuDora(detail.ippatsu_dora !== false);
    setNagashiMangan(!!detail.nagashi_mangan);
    setPao(detail.pao !== false);
    setYakumanMultiple(detail.yakuman_multiple !== false);
    setKokushiAnkanWin(detail.kokushi_ankan_win !== false);
    setFuritenTsumo(detail.furiten_tsumo !== false);
    setTsumobanNoneRiichi(!!detail.tsumoban_none_riichi);
    setWareme(!!detail.wareme);

    // メモ・端数
    setRoundingType(
      typeof basic.rounding_type === 'string' ? basic.rounding_type : '五捨六入'
    );
    setRateNote(typeof basic.rate_note === 'string' ? basic.rate_note : '');
    setHouseNotes(typeof detail.house_notes === 'string' ? detail.house_notes : '');

    setActiveTab('basic');
    setFormError(null);
    setShowCreateModal(true);
  };

  // 公式ルールから初期値をコピーして新規作成モーダルを開く
  const handleOpenDuplicate = (sourceRule: RuleTemplateRow) => {
    populateForm(sourceRule, true);
  };

  // 既存カスタムルールの編集モーダルを開く (バージョンv~ 自動付与)
  const handleOpenEdit = (targetRule: RuleTemplateRow) => {
    populateForm(targetRule, false);
  };

  // ルール保存（新規作成または方式B版管理更新）
  const handleSaveRule = async (e: React.FormEvent) => {
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

      // 編集対象の既存設定があれば詳細プロパティを温存
      let existingConfig: any = {};
      if (editingRuleId) {
        const target = rules.find((r) => r.rule_id === editingRuleId);
        if (target?.config_json) {
          existingConfig = target.config_json;
        }
      }

      const configJson = {
        ...existingConfig,
        basic: {
          ...(existingConfig.basic || {}),
          init_score: initScore,
          return_score: returnScore,
          uma: [uma1, uma2, uma3, uma4],
          uma_type: 'custom',
          game_length: gameLength,
          rounding_type: roundingType,
          rate_note: rateNote.trim(),
        },
        detail: {
          ...(existingConfig.detail || {}),
          renchan_rule: renchanRule,
          tobi_end: tobiEnd,
          sudden_death: suddenDeath,
          west_extension: suddenDeath === 'west' ? 'under_30000' : 'none',
          agari_yame: agariYame,
          tenpai_yame: tenpaiYame,
          noten_bappu_pt: notenBappuPt,
          honba_pt: honbaPt,
          riichi_pt: riichiPt,
          chombo_rule: chomboRule,
          chombo_pt: chomboPt,
          dubron: dubron,
          allow_multi_ron: dubron !== 'atama_hane',
          kyushu: kyushu,
          allow_mid_ryukyoku: kyushu !== 'none',
          kuitan: kuitan,
          aka_dora: akaDora,
          atozuke: atozuke,
          kuikae: kuikae,
          kiriage_mangan: kiriageMangan,
          ippatsu_dora: ippatsuDora,
          nagashi_mangan: nagashiMangan,
          pao: pao,
          yakuman_multiple: yakumanMultiple,
          kokushi_ankan_win: kokushiAnkanWin,
          furiten_tsumo: furitenTsumo,
          tsumoban_none_riichi: tsumobanNoneRiichi,
          wareme: wareme,
          house_notes: houseNotes.trim(),
        },
      };

      if (editingRuleId) {
        // ── 方式B（版管理方式） ──
        // 1. 新しいルールIDで新バージョンを作成 (is_archived = 0)
        const newRuleId = crypto.randomUUID();
        const { error: insertError } = await supabase.from('rule_templates').insert({
          rule_id: newRuleId,
          name: trimmed,
          kind: 'custom',
          version: 1,
          config_json: configJson,
          is_archived: 0,
        });

        if (insertError) throw new Error(insertError.message);

        // 2. 編集元の旧ルールをアーカイブ (is_archived = 1)
        const { error: archiveError } = await supabase
          .from('rule_templates')
          .update({ is_archived: 1 })
          .eq('rule_id', editingRuleId);

        if (archiveError) throw new Error(archiveError.message);

        // 3. 旧ルールを既定にしていたグループがあれば、新ルールへ自動引き継ぎ
        await supabase
          .from('groups')
          .update({ default_rule_id: newRuleId })
          .eq('default_rule_id', editingRuleId);
      } else {
        // 通常の新規作成 (INSERT)
        const { error } = await supabase.from('rule_templates').insert({
          rule_id: crypto.randomUUID(),
          name: trimmed,
          kind: 'custom',
          version: 1,
          config_json: configJson,
          is_archived: 0,
        });

        if (error) throw new Error(error.message);
      }

      setShowCreateModal(false);
      setEditingRuleId(null);
      await loadRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ルールの保存に失敗しました';
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

      {/* ─── モーダル: ルール新規作成・編集 ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl my-4 max-h-[92dvh]">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <h3 className="text-base font-black text-white">
                {editingRuleId ? 'カスタムルールの編集' : 'カスタムルールの作成'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRuleId(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 4タブ切り替え */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className={`py-1.5 text-[11px] font-black rounded-lg transition-all ${
                  activeTab === 'basic'
                    ? 'bg-neutral-800 text-amber-400 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                基本設定
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('flow')}
                className={`py-1.5 text-[11px] font-black rounded-lg transition-all ${
                  activeTab === 'flow'
                    ? 'bg-neutral-800 text-amber-400 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                点数・進行
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rules')}
                className={`py-1.5 text-[11px] font-black rounded-lg transition-all ${
                  activeTab === 'rules'
                    ? 'bg-neutral-800 text-amber-400 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                手役・規定
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`py-1.5 text-[11px] font-black rounded-lg transition-all ${
                  activeTab === 'notes'
                    ? 'bg-neutral-800 text-amber-400 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                メモ・端数
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRule} className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5">
                {/* ─── タブ1: 基本設定 ─── */}
                {activeTab === 'basic' && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-neutral-400">
                        ルール名
                      </label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        placeholder="例: 親族ルール（飛びなし）"
                        className="w-full h-10 px-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-bold text-sm focus:outline-hidden focus:border-amber-500"
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-400">
                        試合形式
                      </label>
                      <select
                        value={gameLength}
                        onChange={(e) => setGameLength(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                      >
                        <option value="hanchan">半荘戦（東南戦）</option>
                        <option value="tonpu">東風戦</option>
                      </select>
                    </div>

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

                    <div className="grid grid-cols-2 gap-2">
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

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          飛び終了
                        </label>
                        <select
                          value={tobiEnd}
                          onChange={(e) => setTobiEnd(e.target.value as any)}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="under_zero">0点未満で終了</option>
                          <option value="zero_or_less">0点以下で終了</option>
                          <option value="none">トビなし（続行）</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-400">
                        オーラス終了時（サドンデス・西入）
                      </label>
                      <select
                        value={suddenDeath}
                        onChange={(e) => setSuddenDeath(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                      >
                        <option value="west">西入あり（トップが返し点未満時）</option>
                        <option value="none">西入なし（規定局で終了）</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          親トップ アガリ止め
                        </label>
                        <select
                          value={agariYame ? 'yes' : 'no'}
                          onChange={(e) => setAgariYame(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり（終了可）</option>
                          <option value="no">なし（続行）</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          親トップ テンパイ止め
                        </label>
                        <select
                          value={tenpaiYame ? 'yes' : 'no'}
                          onChange={(e) => setTenpaiYame(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり（終了可）</option>
                          <option value="no">なし（続行）</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── タブ2: 点数・進行 ─── */}
                {activeTab === 'flow' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          ノーテン罰符（場合計）
                        </label>
                        <select
                          value={notenBappuPt}
                          onChange={(e) => setNotenBappuPt(Number(e.target.value))}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value={3000}>場3,000点（標準）</option>
                          <option value={4000}>場4,000点</option>
                          <option value={0}>なし（0点）</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          本場加算点
                        </label>
                        <select
                          value={honbaPt}
                          onChange={(e) => setHonbaPt(Number(e.target.value))}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value={300}>300点（標準 100オール）</option>
                          <option value={1500}>1,500点（500オール）</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          リーチ棒
                        </label>
                        <input
                          type="number"
                          step={100}
                          value={riichiPt}
                          onChange={(e) => setRiichiPt(Number(e.target.value))}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          途中流局（九種・四風等）
                        </label>
                        <select
                          value={kyushu}
                          onChange={(e) => setKyushu(e.target.value as any)}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="renchan">あり（親連荘）</option>
                          <option value="ryukyoku">あり（親流れ）</option>
                          <option value="none">なし（流局せず続行）</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-400">
                        ダブロン・トリプルロン
                      </label>
                      <select
                        value={dubron}
                        onChange={(e) => setDubron(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                      >
                        <option value="atama_hane_kyotaku">あり（供託・本場は頭ハネ）</option>
                        <option value="atama_hane">なし（頭ハネ / 和了者1名のみ）</option>
                        <option value="split">あり（供託を頭割り分配）</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          チョンボの扱い
                        </label>
                        <select
                          value={chomboRule}
                          onChange={(e) => setChomboRule(e.target.value as any)}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="mangan_pay">満貫払い（親4000/子2000等）</option>
                          <option value="pt_penalty">対局後pt減算</option>
                          <option value="agari_hoki">アガリ放棄のみ</option>
                        </select>
                      </div>

                      {chomboRule === 'pt_penalty' && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-neutral-400">
                            減算ペナルティ (pt)
                          </label>
                          <input
                            type="number"
                            value={chomboPt}
                            onChange={(e) => setChomboPt(Number(e.target.value))}
                            className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ─── タブ3: 手役・規定 ─── */}
                {activeTab === 'rules' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          喰いタン
                        </label>
                        <select
                          value={kuitan ? 'yes' : 'no'}
                          onChange={(e) => setKuitan(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり</option>
                          <option value="no">なし</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          赤牌（赤ドラ）
                        </label>
                        <select
                          value={akaDora}
                          onChange={(e) => setAkaDora(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="3枚">3枚（各1枚）</option>
                          <option value="4枚 (赤5筒2枚)">4枚（赤5筒2枚）</option>
                          <option value="なし">なし</option>
                          <option value="その他">その他（特殊牌等）</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          後付け
                        </label>
                        <select
                          value={atozuke ? 'yes' : 'no'}
                          onChange={(e) => setAtozuke(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり（完全アリアリ）</option>
                          <option value="no">なし（ナシナシ / 先付け）</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          喰い替え
                        </label>
                        <select
                          value={kuikae}
                          onChange={(e) => setKuikae(e.target.value as any)}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="prohibited">不可（禁止）</option>
                          <option value="allowed">可</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          切り上げ満貫
                        </label>
                        <select
                          value={kiriageMangan ? 'yes' : 'no'}
                          onChange={(e) => setKiriageMangan(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="no">なし（30符4飜7,700点等）</option>
                          <option value="yes">あり（30符4飜を満貫8,000点）</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          一発・裏ドラ・カンドラ
                        </label>
                        <select
                          value={ippatsuDora ? 'yes' : 'no'}
                          onChange={(e) => setIppatsuDora(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり</option>
                          <option value="no">なし（競技ルール等）</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          パオ（役満責任払い）
                        </label>
                        <select
                          value={pao ? 'yes' : 'no'}
                          onChange={(e) => setPao(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり（ツモ全額/ロン折半）</option>
                          <option value="no">なし</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          役満複合・数え役満
                        </label>
                        <select
                          value={yakumanMultiple ? 'yes' : 'no'}
                          onChange={(e) => setYakumanMultiple(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり</option>
                          <option value="no">なし</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          国士無双 暗カンアガリ
                        </label>
                        <select
                          value={kokushiAnkanWin ? 'yes' : 'no'}
                          onChange={(e) => setKokushiAnkanWin(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり（暗カン槍槓）</option>
                          <option value="no">なし</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          フリテンリーチ・見逃しツモ
                        </label>
                        <select
                          value={furitenTsumo ? 'yes' : 'no'}
                          onChange={(e) => setFuritenTsumo(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="yes">あり</option>
                          <option value="no">なし</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          ツモ番なしリーチ
                        </label>
                        <select
                          value={tsumobanNoneRiichi ? 'yes' : 'no'}
                          onChange={(e) => setTsumobanNoneRiichi(e.target.value === 'yes')}
                          className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                        >
                          <option value="no">不可（残り山3枚以下）</option>
                          <option value="yes">可能</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-neutral-400">
                          特殊役・加算ルール
                        </label>
                        <div className="flex items-center gap-3 pt-2">
                          <label className="flex items-center gap-1.5 text-xs text-neutral-300 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={nagashiMangan}
                              onChange={(e) => setNagashiMangan(e.target.checked)}
                              className="w-4 h-4 rounded bg-neutral-950 border-neutral-700 text-amber-500 focus:ring-0"
                            />
                            流し満貫
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-neutral-300 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={wareme}
                              onChange={(e) => setWareme(e.target.checked)}
                              className="w-4 h-4 rounded bg-neutral-950 border-neutral-700 text-amber-500 focus:ring-0"
                            />
                            割れ目
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── タブ4: メモ・端数 ─── */}
                {activeTab === 'notes' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-400">
                        最終端数処理（成績集計時）
                      </label>
                      <select
                        value={roundingType}
                        onChange={(e) => setRoundingType(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                      >
                        <option value="五捨六入">五捨六入（Mリーグ・標準）</option>
                        <option value="四捨五入">四捨五入</option>
                        <option value="切り捨て">切り捨て</option>
                        <option value="切り上げ">切り上げ</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-400">
                        レート・換算メモ
                      </label>
                      <input
                        type="text"
                        value={rateNote}
                        onChange={(e) => setRateNote(e.target.value)}
                        placeholder="例: 点20 / ウマ10-30 / 祝儀200P"
                        className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-neutral-400">
                        ハウスルール補足メモ（複数行可）
                      </label>
                      <textarea
                        rows={4}
                        value={houseNotes}
                        onChange={(e) => setHouseNotes(e.target.value)}
                        placeholder="例: 先ヅモ厳禁。見せ牌・腰牌の罰則なし。終了時は点棒を綺麗に揃えて返却。"
                        className="w-full p-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-medium text-xs resize-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* フッターアクションボタン */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRuleId(null);
                  }}
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

      {/* ─── 詳細確認モーダル ─── */}
      {detailModalRule && (
        <RuleDetailModal
          ruleName={detailModalRule.name}
          config={detailModalRule.config_json as any}
          isOfficial={detailModalRule.kind === 'official'}
          onClose={() => setDetailModalRule(null)}
          onEdit={() => handleOpenEdit(detailModalRule)}
        />
      )}
    </main>
  );
}
