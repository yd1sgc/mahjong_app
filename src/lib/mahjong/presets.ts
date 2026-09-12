/**
 * 麻雀点数プリセット定数定義
 * 子・親のロン/ツモ主要打点、3x4グリッド用定義、翻・符の選択肢テーブル
 */

export interface ScorePresetItem {
  label: string;
  pts: number;
  han: number;
  fu: number;
}

/** 子ロン 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const KO_RON_PRESETS_3X4: ScorePresetItem[] = [
  { label: '1,000 (1翻30符)', pts: 1000, han: 1, fu: 30 },
  { label: '1,300 (1翻40符)', pts: 1300, han: 1, fu: 40 },
  { label: '1,600 (1翻50符)', pts: 1600, han: 1, fu: 50 },
  { label: '2,000 (2翻30符)', pts: 2000, han: 2, fu: 30 },
  { label: '2,600 (2翻40符)', pts: 2600, han: 2, fu: 40 },
  { label: '3,200 (2翻50符)', pts: 3200, han: 2, fu: 50 },
  { label: '3,900 (3翻30符)', pts: 3900, han: 3, fu: 30 },
  { label: '5,200 (3翻40符)', pts: 5200, han: 3, fu: 40 },
  { label: '7,700 (4翻30符)', pts: 7700, han: 4, fu: 30 },
  { label: '8,000 (満貫)', pts: 8000, han: 4, fu: 40 },
  { label: '12,000 (跳満)', pts: 12000, han: 6, fu: 30 },
];

/** 親ロン 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const OYA_RON_PRESETS_3X4: ScorePresetItem[] = [
  { label: '1,500 (1翻30符)', pts: 1500, han: 1, fu: 30 },
  { label: '2,000 (1翻40符)', pts: 2000, han: 1, fu: 40 },
  { label: '2,400 (1翻50符)', pts: 2400, han: 1, fu: 50 },
  { label: '2,900 (2翻30符)', pts: 2900, han: 2, fu: 30 },
  { label: '3,900 (2翻40符)', pts: 3900, han: 2, fu: 40 },
  { label: '4,800 (2翻50符)', pts: 4800, han: 2, fu: 50 },
  { label: '5,800 (3翻30符)', pts: 5800, han: 3, fu: 30 },
  { label: '7,700 (3翻40符)', pts: 7700, han: 3, fu: 40 },
  { label: '11,600 (4翻30符)', pts: 11600, han: 4, fu: 30 },
  { label: '12,000 (満貫)', pts: 12000, han: 4, fu: 40 },
  { label: '18,000 (跳満)', pts: 18000, han: 6, fu: 30 },
];

/** 子ツモ 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const KO_TSUMO_PRESETS_3X4: ScorePresetItem[] = [
  { label: '300 / 500 (1翻30符)', pts: 1100, han: 1, fu: 30 },
  { label: '400 / 700 (1翻40符)', pts: 1500, han: 1, fu: 40 },
  { label: '400 / 800 (1翻50符)', pts: 1600, han: 1, fu: 50 },
  { label: '500 / 1,000 (2翻30符)', pts: 2000, han: 2, fu: 30 },
  { label: '700 / 1,300 (2翻40符)', pts: 2700, han: 2, fu: 40 },
  { label: '800 / 1,600 (2翻50符)', pts: 3200, han: 2, fu: 50 },
  { label: '1,000 / 2,000 (3翻30符)', pts: 4000, han: 3, fu: 30 },
  { label: '1,300 / 2,600 (3翻40符)', pts: 5200, han: 3, fu: 40 },
  { label: '2,000 / 3,900 (4翻30符)', pts: 7900, han: 4, fu: 30 },
  { label: '2,000 / 4,000 (満貫)', pts: 8000, han: 4, fu: 40 },
  { label: '3,000 / 6,000 (跳満)', pts: 12000, han: 6, fu: 30 },
];

/** 親ツモ 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const OYA_TSUMO_PRESETS_3X4: ScorePresetItem[] = [
  { label: '500オール (1翻30符)', pts: 1500, han: 1, fu: 30 },
  { label: '700オール (1翻40符)', pts: 2100, han: 1, fu: 40 },
  { label: '800オール (1翻50符)', pts: 2400, han: 1, fu: 50 },
  { label: '1,000オール (2翻30符)', pts: 3000, han: 2, fu: 30 },
  { label: '1,300オール (2翻40符)', pts: 3900, han: 2, fu: 40 },
  { label: '1,500オール (2翻50符)', pts: 4500, han: 2, fu: 50 },
  { label: '2,000オール (3翻30符)', pts: 6000, han: 3, fu: 30 },
  { label: '2,600オール (3翻40符)', pts: 7800, han: 3, fu: 40 },
  { label: '3,900オール (4翻30符)', pts: 11700, han: 4, fu: 30 },
  { label: '4,000オール (満貫)', pts: 12000, han: 4, fu: 40 },
  { label: '6,000オール (跳満)', pts: 18000, han: 6, fu: 30 },
];

/** 倍満以上クイック選択用 */
export const HIGH_SCORE_PRESETS = {
  ko_ron: [
    { label: '16,000 (倍満)', pts: 16000, han: 8, fu: 30 },
    { label: '24,000 (三倍満)', pts: 24000, han: 11, fu: 30 },
    { label: '32,000 (役満)', pts: 32000, han: 13, fu: 30 },
  ],
  oya_ron: [
    { label: '24,000 (倍満)', pts: 24000, han: 8, fu: 30 },
    { label: '36,000 (三倍満)', pts: 36000, han: 11, fu: 30 },
    { label: '48,000 (役満)', pts: 48000, han: 13, fu: 30 },
  ],
  ko_tsumo: [
    { label: '4,000 / 8,000 (倍満)', pts: 16000, han: 8, fu: 30 },
    { label: '6,000 / 12,000 (三倍満)', pts: 24000, han: 11, fu: 30 },
    { label: '8,000 / 16,000 (役満)', pts: 32000, han: 13, fu: 30 },
  ],
  oya_tsumo: [
    { label: '8,000オール (倍満)', pts: 24000, han: 8, fu: 30 },
    { label: '12,000オール (三倍満)', pts: 36000, han: 11, fu: 30 },
    { label: '16,000オール (役満)', pts: 48000, han: 13, fu: 30 },
  ],
};

// 互換性維持のための従来のエイリアス
export const KO_RON_PRESETS = KO_RON_PRESETS_3X4;
export const OYA_RON_PRESETS = OYA_RON_PRESETS_3X4;
export const KO_TSUMO_PRESETS = KO_TSUMO_PRESETS_3X4;
export const OYA_TSUMO_PRESETS = OYA_TSUMO_PRESETS_3X4;

export const HAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 13];
export const FU_OPTIONS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
