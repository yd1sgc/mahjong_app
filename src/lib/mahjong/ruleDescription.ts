/**
 * ルール詳細説明生成モジュール (ruleDescription.ts)
 * 成績や試合進行には直接影響しないが、どのような取り決めで打っているか
 * （喰いタン、赤牌、途中流局、パオ、チョンボ、ハウスルールメモ等）を
 * カテゴリ別に体系化した日本語説明マップを生成する純粋関数
 */

import { RuleConfig } from '../../types/mahjong';

export interface RuleDescription {
  [category: string]: string[];
}

/**
 * ルール設定オブジェクトからカテゴリ別説明マップを生成
 * @param config 対局またはテンプレートのルール設定
 * @returns カテゴリ名をキーとする説明文リスト
 */
export function generateRuleDescription(config?: RuleConfig | null): RuleDescription {
  const basic = config?.basic || config || {};
  const detail = config?.detail || {};

  const initScore = basic.init_score ?? 25000;
  const returnScore = basic.return_score ?? 30000;
  const uma = Array.isArray(basic.uma) ? basic.uma : [50, 10, -10, -30];
  const umaStr = uma.map((u) => (u > 0 ? `+${u}` : `${u}`)).join(', ');

  // トビ終了条件
  const tobiType = detail.tobi_end ?? 'under_zero';
  const tobiStr =
    tobiType === 'under_zero'
      ? '飛びあり (0点未満)'
      : tobiType === 'zero_or_less'
      ? '飛びあり (0点以下)'
      : 'トビなし';

  // 1. 精算
  const seisan: string[] = [
    `${initScore.toLocaleString()}点持ち / ${returnScore.toLocaleString()}点返し / ${tobiStr}`,
    `順位点 (ウマ)：[${umaStr}]`,
    `端数処理：${(basic as Record<string, unknown>).rounding_type || '五捨六入'}`,
  ];
  const rateNote = (basic as Record<string, unknown>).rate_note;
  if (typeof rateNote === 'string' && rateNote.trim()) {
    seisan.push(`レート・換算メモ：${rateNote.trim()}`);
  }

  // 2. 基本・アリアリルール
  const kuitanStr = detail.kuitan !== false ? 'あり' : 'なし';
  const atozukeStr = detail.atozuke !== false ? 'あり' : 'なし';
  const akaStr = (detail as Record<string, unknown>).aka_dora || '3枚';
  const kuikaeStr = (detail as Record<string, unknown>).kuikae === 'allowed' ? '可' : '不可';

  const kihon: string[] = [
    `喰いタン：${kuitanStr} / 後付け：${atozukeStr} / 赤牌：${akaStr}`,
    `喰い替え：${kuikaeStr} / 一発・カンドラ・裏ドラあり`,
    `フリテンリーチ・見逃しツモ：${(detail as Record<string, unknown>).furiten_tsumo !== false ? 'あり' : 'なし'}`,
    `ツモ番なしリーチ：${(detail as Record<string, unknown>).tsumoban_none_riichi ? '可能' : '不可'}`,
  ];

  // 3. 試合の進行
  const renchanMap: Record<string, string> = {
    tenpai: '聴牌連荘',
    agari: '和了連荘',
    noten: 'ノーテン連荘',
  };
  const renchanStr = renchanMap[detail.renchan_rule || 'tenpai'] || '聴牌連荘';

  const westMap: Record<string, string> = {
    under_30000: 'トップ30,000点未満で西入 (サドンデス)',
    none: 'なし (オーラスで必ず終了)',
    fixed_nan4: '南4局固定終了',
  };
  const westStr = westMap[detail.west_extension || 'under_30000'] || '西入あり';

  const agariYameStr = detail.agari_yame !== false ? 'あり' : 'なし';
  const tenpaiYameStr = detail.tenpai_yame !== false ? 'あり' : 'なし';

  const shinko: string[] = [
    `親連荘条件：${renchanStr}`,
    `西入延長：${westStr}`,
    `アガリ止め：${agariYameStr} / テンパイ止め：${tenpaiYameStr}`,
  ];

  const midRyuMap: Record<string, string> = {
    renchan: 'あり (連荘)',
    ryukyoku: 'あり (親流れ/流局)',
    none: 'なし (流局とせず続行)',
  };
  const kyushuStr = midRyuMap[detail.kyushu || 'renchan'] || 'あり (連荘)';
  shinko.push(`途中流局 (九種・四風など)：${kyushuStr}`);

  // 4. 特殊ルール・チョンボ
  const dubronMap: Record<string, string> = {
    atama_hane: 'なし (頭ハネ/上家取り)',
    atama_hane_kyotaku: 'あり (供託は頭ハネ)',
    split: 'あり (全分配)',
  };
  const dubronStr = dubronMap[(detail as Record<string, unknown>).dubron as string || 'atama_hane_kyotaku'] || 'あり (供託は頭ハネ)';

  const chomboMap: Record<string, string> = {
    mangan_pay: '満貫払い',
    pt_penalty: `対局後 -${detail.chombo_pt ?? 20}pt 直減算`,
    agari_hoki: 'アガリ放棄のみ',
  };
  const chomboStr = chomboMap[detail.chombo_rule || 'mangan_pay'] || '満貫払い';

  const tokushu: string[] = [
    `ダブロン・トリロン：${dubronStr}`,
    `パオ (責任払い)：${(detail as Record<string, unknown>).pao !== false ? 'あり (ツモ全額/ロン折半)' : 'なし'}`,
    `役満複合・数え役満：${(detail as Record<string, unknown>).yakuman_multiple !== false ? 'あり' : 'なし'}`,
    `国士無双暗カンアガリ：${(detail as Record<string, unknown>).kokushi_ankan_win !== false ? 'あり' : 'なし'}`,
    `チョンボ扱い：${chomboStr}`,
  ];

  const res: RuleDescription = {
    精算: seisan,
    '基本・アリアリルール': kihon,
    試合の進行: shinko,
    '特殊ルール・チョンボ': tokushu,
  };

  const houseNotes = (detail as Record<string, unknown>).house_notes;
  if (typeof houseNotes === 'string' && houseNotes.trim()) {
    res['ハウスルール補足メモ'] = houseNotes
      .trim()
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
  }

  return res;
}
