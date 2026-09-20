/**
 * ルール作成・編集モーダルコンポーネント (RuleEditModal.tsx)
 * 
 * 4タブ構成（基本設定、点数・進行、手役・取り決め、メモ・端数）
 * 方式B（版管理方式）：既存ルールの編集時は新ルール作成＋旧ルールアーカイブ＋グループ自動引き継ぎ
 */

'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RuleTemplateRow } from '@/types/database';
import { validateRuleInput, MAX_RULE_NAME_LENGTH } from '@/lib/mahjong/validation';
import { RuleConfig } from '@/types/mahjong';
import { AdminPinModal } from '@/components/manage/AdminPinModal';
import { isAdminAuthenticated } from '@/lib/adminAuth';

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

export interface RuleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  rules: RuleTemplateRow[];
  sourceRule: RuleTemplateRow | null;
  isDuplicate: boolean;
}

export const RuleEditModal: React.FC<RuleEditModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  rules,
  sourceRule,
  isDuplicate,
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'flow' | 'rules' | 'notes'>('basic');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

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

  // フォーム初期化処理
  useEffect(() => {
    if (!isOpen) return;

    if (sourceRule) {
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
    } else {
      setEditingRuleId(null);
      setRuleName('');
      setGameLength('hanchan');
      setInitScore(25000);
      setReturnScore(30000);
      setUma1(50);
      setUma2(10);
      setUma3(-10);
      setUma4(-30);
      setRenchanRule('tenpai');
      setTobiEnd('under_zero');
      setSuddenDeath('west');
      setAgariYame(true);
      setTenpaiYame(true);
      setNotenBappuPt(3000);
      setHonbaPt(300);
      setRiichiPt(1000);
      setChomboRule('mangan_pay');
      setChomboPt(20);
      setDubron('atama_hane_kyotaku');
      setKyushu('renchan');
      setKuitan(true);
      setAkaDora('3枚');
      setAtozuke(true);
      setKuikae('prohibited');
      setKiriageMangan(false);
      setIppatsuDora(true);
      setNagashiMangan(false);
      setPao(true);
      setYakumanMultiple(true);
      setKokushiAnkanWin(true);
      setFuritenTsumo(true);
      setTsumobanNoneRiichi(false);
      setWareme(false);
      setRoundingType('五捨六入');
      setRateNote('');
      setHouseNotes('');
    }

    setActiveTab('basic');
    setFormError(null);
  }, [isOpen, sourceRule, isDuplicate]);

  if (!isOpen) return null;

  // プリセット適用ヘルパー
  const applyPreset = (presetRule: RuleTemplateRow) => {
    const cfg = (presetRule.config_json || {}) as Record<string, unknown>;
    const basic = (cfg.basic || cfg || {}) as Record<string, unknown>;
    const detail = (cfg.detail || {}) as Record<string, unknown>;

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
    setRoundingType(
      typeof basic.rounding_type === 'string' ? basic.rounding_type : '五捨六入'
    );
  };

  // 実際のルール保存処理
  const performSave = async () => {
    const trimmed = ruleName.trim();

    try {
      setSubmitting(true);
      setFormError(null);

      let existingConfig: Partial<RuleConfig> = {};
      if (editingRuleId) {
        const target = rules.find((r) => r.rule_id === editingRuleId);
        if (target?.config_json) {
          existingConfig = target.config_json as unknown as Partial<RuleConfig>;
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

        const { error: archiveError } = await supabase
          .from('rule_templates')
          .update({ is_archived: 1 })
          .eq('rule_id', editingRuleId);

        if (archiveError) throw new Error(archiveError.message);

        await supabase
          .from('groups')
          .update({ default_rule_id: newRuleId })
          .eq('default_rule_id', editingRuleId);
      } else {
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

      await onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ルールの保存に失敗しました';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ルール保存ハンドラー
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRuleInput({
      name: ruleName,
      initScore,
      returnScore,
      uma: [uma1, uma2, uma3, uma4],
    });

    if (!validation.valid) {
      setFormError(validation.error || '入力内容を確認してください');
      return;
    }

    // 既存ルールの更新（版上げ・アーカイブ）時は管理者PIN認証が必要
    if (editingRuleId && !isAdminAuthenticated()) {
      setShowPinModal(true);
      return;
    }

    await performSave();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl my-4 max-h-[92dvh]">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
          <h3 className="text-base font-black text-white">
            {editingRuleId ? 'カスタムルールの編集' : 'カスタムルールの作成'}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
            手役・取り決め
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

        <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-y-auto pr-1">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
              {formError}
            </div>
          )}

          {/* ══════════ タブ1: 基本設定 ══════════ */}
          {activeTab === 'basic' && (
            <div className="flex flex-col gap-3">
              {/* 初期値プリセット適用 */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-[10px] font-black text-neutral-400">
                  初期値プリセットから入力補助（上書き）:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {rules
                    .filter((r) => r.kind === 'official')
                    .map((r) => (
                      <button
                        key={r.rule_id}
                        type="button"
                        onClick={() => applyPreset(r)}
                        className="px-2 py-1 rounded bg-neutral-850 hover:bg-neutral-750 text-[10px] font-bold text-neutral-300 transition-colors"
                      >
                        {r.name}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  ルール名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  maxLength={MAX_RULE_NAME_LENGTH}
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
                  onChange={(e) => setGameLength(e.target.value as 'hanchan' | 'tonpu')}
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                >
                  <option value="hanchan">半荘戦（東南戦）</option>
                  <option value="tonpu">東風戦</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    配給原点 (点)
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={initScore}
                    onChange={(e) => setInitScore(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    返し点 (点)
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={returnScore}
                    onChange={(e) => setReturnScore(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
              </div>

              {/* ウマ入力 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-400">
                    順位ウマ (1位 / 2位 / 3位 / 4位)
                  </label>
                  <span className="text-[10px] font-bold text-neutral-500">
                    合計: {uma1 + uma2 + uma3 + uma4} pt
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <input
                    type="number"
                    value={uma1}
                    onChange={(e) => setUma1(Number(e.target.value))}
                    className="h-9 px-2 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                  <input
                    type="number"
                    value={uma2}
                    onChange={(e) => setUma2(Number(e.target.value))}
                    className="h-9 px-2 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                  <input
                    type="number"
                    value={uma3}
                    onChange={(e) => setUma3(Number(e.target.value))}
                    className="h-9 px-2 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                  <input
                    type="number"
                    value={uma4}
                    onChange={(e) => setUma4(Number(e.target.value))}
                    className="h-9 px-2 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══════════ タブ2: 点数・進行 ══════════ */}
          {activeTab === 'flow' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    連荘条件
                  </label>
                  <select
                    value={renchanRule}
                    onChange={(e) => setRenchanRule(e.target.value as 'tenpai' | 'agari')}
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
                    onChange={(e) => setTobiEnd(e.target.value as 'under_zero' | 'zero_or_less' | 'none')}
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
                  onChange={(e) => setSuddenDeath(e.target.value as 'west' | 'none')}
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                >
                  <option value="west">西入あり（トップが返し点未満時）</option>
                  <option value="none">西入なし（規定局で終了）</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agariYame}
                    onChange={(e) => setAgariYame(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">アガリ止めあり</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tenpaiYame}
                    onChange={(e) => setTenpaiYame(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">テンパイ止めあり</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    ノーテン罰符 (場全体)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={notenBappuPt}
                    onChange={(e) => setNotenBappuPt(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    本場加算 (1本場あたり)
                  </label>
                  <input
                    type="number"
                    step={100}
                    value={honbaPt}
                    onChange={(e) => setHonbaPt(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    立直料 (点)
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
                    onChange={(e) => setKyushu(e.target.value as 'renchan' | 'ryukyoku' | 'none')}
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
                  onChange={(e) => setDubron(e.target.value as 'atama_hane_kyotaku' | 'atama_hane' | 'split')}
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
                    onChange={(e) => setChomboRule(e.target.value as 'mangan_pay' | 'pt_penalty' | 'agari_hoki')}
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
                      減算pt (pt)
                    </label>
                    <input
                      type="number"
                      step={5}
                      value={chomboPt}
                      onChange={(e) => setChomboPt(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ タブ3: 手役・取り決め ══════════ */}
          {activeTab === 'rules' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kuitan}
                    onChange={(e) => setKuitan(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">喰い断あり</span>
                </label>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    赤ドラ
                  </label>
                  <input
                    type="text"
                    value={akaDora}
                    onChange={(e) => setAkaDora(e.target.value)}
                    placeholder="例: 3枚 (5萬・5筒・5索)"
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400">
                    後付け（アリアリ/完全先付け）
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
                    onChange={(e) => setKuikae(e.target.value as 'prohibited' | 'allowed')}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                  >
                    <option value="prohibited">不可（禁止）</option>
                    <option value="allowed">可</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kiriageMangan}
                    onChange={(e) => setKiriageMangan(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">切り上げ満貫</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ippatsuDora}
                    onChange={(e) => setIppatsuDora(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">一発・裏ドラあり</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nagashiMangan}
                    onChange={(e) => setNagashiMangan(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">流し満貫あり</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pao}
                    onChange={(e) => setPao(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">責任払い（パオ）</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={yakumanMultiple}
                    onChange={(e) => setYakumanMultiple(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">役満重複あり</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kokushiAnkanWin}
                    onChange={(e) => setKokushiAnkanWin(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">国士無双の暗槓和了</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={furitenTsumo}
                    onChange={(e) => setFuritenTsumo(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">フリテンツモあり</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tsumobanNoneRiichi}
                    onChange={(e) => setTsumobanNoneRiichi(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">ツモ番なし立直</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wareme}
                    onChange={(e) => setWareme(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-bold text-white">ワレメあり</span>
                </label>
              </div>
            </div>
          )}

          {/* ══════════ タブ4: メモ・端数 ══════════ */}
          {activeTab === 'notes' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  端数計算方式
                </label>
                <input
                  type="text"
                  value={roundingType}
                  onChange={(e) => setRoundingType(e.target.value)}
                  placeholder="例: 五捨六入 / 四捨五入 / 切り捨て"
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  精算レート・点数メモ
                </label>
                <input
                  type="text"
                  value={rateNote}
                  onChange={(e) => setRateNote(e.target.value)}
                  placeholder="例: 1点1円、1000点相当など"
                  className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400">
                  ハウスルール備考・特記事項
                </label>
                <textarea
                  rows={4}
                  value={houseNotes}
                  onChange={(e) => setHouseNotes(e.target.value)}
                  placeholder="例: アガリ連荘、流局時親流れ。ノーテン罰符場3000など"
                  className="w-full p-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-bold text-xs resize-none"
                />
              </div>
            </div>
          )}

          {/* 確定・キャンセルボタン */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !ruleName.trim()}
              className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-40 text-black font-black text-xs transition-all shadow-md"
            >
              {submitting ? '保存中...' : editingRuleId ? '更新（次バージョン作成）' : '新規作成'}
            </button>
          </div>
        </form>
      </div>

      {/* 管理者PIN認証モーダル */}
      <AdminPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          performSave();
        }}
      />
    </div>
  );
};
