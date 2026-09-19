/**
 * 麻雀点数プリセット定数定義
 * 子・親のロン/ツモ主要打点、3x4グリッド用定義、翻・符の選択肢テーブル
 */

export interface ScorePresetItem {
  label: string;
  pointsLabel: string;
  hanFuLabel: string;
  pts: number;
  han: number;
  fu: number;
}

/** 子ロン 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const KO_RON_PRESETS_3X4: ScorePresetItem[] = [
  { label: '1000 (1翻30符)', pointsLabel: '1000', hanFuLabel: '1翻30符', pts: 1000, han: 1, fu: 30 },
  { label: '1300 (1翻40符)', pointsLabel: '1300', hanFuLabel: '1翻40符', pts: 1300, han: 1, fu: 40 },
  { label: '1600 (1翻50符)', pointsLabel: '1600', hanFuLabel: '1翻50符', pts: 1600, han: 1, fu: 50 },
  { label: '2000 (2翻30符)', pointsLabel: '2000', hanFuLabel: '2翻30符', pts: 2000, han: 2, fu: 30 },
  { label: '2600 (2翻40符)', pointsLabel: '2600', hanFuLabel: '2翻40符', pts: 2600, han: 2, fu: 40 },
  { label: '3200 (2翻50符)', pointsLabel: '3200', hanFuLabel: '2翻50符', pts: 3200, han: 2, fu: 50 },
  { label: '3900 (3翻30符)', pointsLabel: '3900', hanFuLabel: '3翻30符', pts: 3900, han: 3, fu: 30 },
  { label: '5200 (3翻40符)', pointsLabel: '5200', hanFuLabel: '3翻40符', pts: 5200, han: 3, fu: 40 },
  { label: '7700 (4翻30符)', pointsLabel: '7700', hanFuLabel: '4翻30符', pts: 7700, han: 4, fu: 30 },
  { label: '8000 (満貫)', pointsLabel: '8000', hanFuLabel: '満貫', pts: 8000, han: 4, fu: 40 },
  { label: '12000 (跳満)', pointsLabel: '12000', hanFuLabel: '跳満', pts: 12000, han: 6, fu: 30 },
];

/** 親ロン 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const OYA_RON_PRESETS_3X4: ScorePresetItem[] = [
  { label: '1500 (1翻30符)', pointsLabel: '1500', hanFuLabel: '1翻30符', pts: 1500, han: 1, fu: 30 },
  { label: '2000 (1翻40符)', pointsLabel: '2000', hanFuLabel: '1翻40符', pts: 2000, han: 1, fu: 40 },
  { label: '2400 (1翻50符)', pointsLabel: '2400', hanFuLabel: '1翻50符', pts: 2400, han: 1, fu: 50 },
  { label: '2900 (2翻30符)', pointsLabel: '2900', hanFuLabel: '2翻30符', pts: 2900, han: 2, fu: 30 },
  { label: '3900 (2翻40符)', pointsLabel: '3900', hanFuLabel: '2翻40符', pts: 3900, han: 2, fu: 40 },
  { label: '4800 (2翻50符)', pointsLabel: '4800', hanFuLabel: '2翻50符', pts: 4800, han: 2, fu: 50 },
  { label: '5800 (3翻30符)', pointsLabel: '5800', hanFuLabel: '3翻30符', pts: 5800, han: 3, fu: 30 },
  { label: '7700 (3翻40符)', pointsLabel: '7700', hanFuLabel: '3翻40符', pts: 7700, han: 3, fu: 40 },
  { label: '11600 (4翻30符)', pointsLabel: '11600', hanFuLabel: '4翻30符', pts: 11600, han: 4, fu: 30 },
  { label: '12000 (満貫)', pointsLabel: '12000', hanFuLabel: '満貫', pts: 12000, han: 4, fu: 40 },
  { label: '18000 (跳満)', pointsLabel: '18000', hanFuLabel: '跳満', pts: 18000, han: 6, fu: 30 },
];

/** 子ツモ 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const KO_TSUMO_PRESETS_3X4: ScorePresetItem[] = [
  { label: '300/500 (1翻30符)', pointsLabel: '300/500', hanFuLabel: '1翻30符', pts: 1100, han: 1, fu: 30 },
  { label: '400/700 (1翻40符)', pointsLabel: '400/700', hanFuLabel: '1翻40符', pts: 1500, han: 1, fu: 40 },
  { label: '400/800 (1翻50符)', pointsLabel: '400/800', hanFuLabel: '1翻50符', pts: 1600, han: 1, fu: 50 },
  { label: '500/1000 (2翻30符)', pointsLabel: '500/1000', hanFuLabel: '2翻30符', pts: 2000, han: 2, fu: 30 },
  { label: '700/1300 (2翻40符)', pointsLabel: '700/1300', hanFuLabel: '2翻40符', pts: 2700, han: 2, fu: 40 },
  { label: '800/1600 (2翻50符)', pointsLabel: '800/1600', hanFuLabel: '2翻50符', pts: 3200, han: 2, fu: 50 },
  { label: '1000/2000 (3翻30符)', pointsLabel: '1000/2000', hanFuLabel: '3翻30符', pts: 4000, han: 3, fu: 30 },
  { label: '1300/2600 (3翻40符)', pointsLabel: '1300/2600', hanFuLabel: '3翻40符', pts: 5200, han: 3, fu: 40 },
  { label: '2000/3900 (4翻30符)', pointsLabel: '2000/3900', hanFuLabel: '4翻30符', pts: 7900, han: 4, fu: 30 },
  { label: '2000/4000 (満貫)', pointsLabel: '2000/4000', hanFuLabel: '満貫', pts: 8000, han: 4, fu: 40 },
  { label: '3000/6000 (跳満)', pointsLabel: '3000/6000', hanFuLabel: '跳満', pts: 12000, han: 6, fu: 30 },
];

/** 親ツモ 3x4 グリッド用 (11枠 + 倍満〜/その他) */
export const OYA_TSUMO_PRESETS_3X4: ScorePresetItem[] = [
  { label: '500オール (1翻30符)', pointsLabel: '500オール', hanFuLabel: '1翻30符', pts: 1500, han: 1, fu: 30 },
  { label: '700オール (1翻40符)', pointsLabel: '700オール', hanFuLabel: '1翻40符', pts: 2100, han: 1, fu: 40 },
  { label: '800オール (1翻50符)', pointsLabel: '800オール', hanFuLabel: '1翻50符', pts: 2400, han: 1, fu: 50 },
  { label: '1000オール (2翻30符)', pointsLabel: '1000オール', hanFuLabel: '2翻30符', pts: 3000, han: 2, fu: 30 },
  { label: '1300オール (2翻40符)', pointsLabel: '1300オール', hanFuLabel: '2翻40符', pts: 3900, han: 2, fu: 40 },
  { label: '1500オール (2翻50符)', pointsLabel: '1500オール', hanFuLabel: '2翻50符', pts: 4500, han: 2, fu: 50 },
  { label: '2000オール (3翻30符)', pointsLabel: '2000オール', hanFuLabel: '3翻30符', pts: 6000, han: 3, fu: 30 },
  { label: '2600オール (3翻40符)', pointsLabel: '2600オール', hanFuLabel: '3翻40符', pts: 7800, han: 3, fu: 40 },
  { label: '3900オール (4翻30符)', pointsLabel: '3900オール', hanFuLabel: '4翻30符', pts: 11700, han: 4, fu: 30 },
  { label: '4000オール (満貫)', pointsLabel: '4000オール', hanFuLabel: '満貫', pts: 12000, han: 4, fu: 40 },
  { label: '6000オール (跳満)', pointsLabel: '6000オール', hanFuLabel: '跳満', pts: 18000, han: 6, fu: 30 },
];

/** 倍満以上クイック選択用 */
export const HIGH_SCORE_PRESETS: Record<string, ScorePresetItem[]> = {
  ko_ron: [
    { label: '16000 (倍満)', pointsLabel: '16000', hanFuLabel: '倍満', pts: 16000, han: 8, fu: 30 },
    { label: '24000 (三倍満)', pointsLabel: '24000', hanFuLabel: '三倍満', pts: 24000, han: 11, fu: 30 },
    { label: '32000 (役満)', pointsLabel: '32000', hanFuLabel: '役満', pts: 32000, han: 13, fu: 30 },
  ],
  oya_ron: [
    { label: '24000 (倍満)', pointsLabel: '24000', hanFuLabel: '倍満', pts: 24000, han: 8, fu: 30 },
    { label: '36000 (三倍満)', pointsLabel: '36000', hanFuLabel: '三倍満', pts: 36000, han: 11, fu: 30 },
    { label: '48000 (役満)', pointsLabel: '48000', hanFuLabel: '役満', pts: 48000, han: 13, fu: 30 },
  ],
  ko_tsumo: [
    { label: '4000/8000 (倍満)', pointsLabel: '4000/8000', hanFuLabel: '倍満', pts: 16000, han: 8, fu: 30 },
    { label: '6000/12000 (三倍満)', pointsLabel: '6000/12000', hanFuLabel: '三倍満', pts: 24000, han: 11, fu: 30 },
    { label: '8000/16000 (役満)', pointsLabel: '8000/16000', hanFuLabel: '役満', pts: 32000, han: 13, fu: 30 },
  ],
  oya_tsumo: [
    { label: '8000オール (倍満)', pointsLabel: '8000オール', hanFuLabel: '倍満', pts: 24000, han: 8, fu: 30 },
    { label: '12000オール (三倍満)', pointsLabel: '12000オール', hanFuLabel: '三倍満', pts: 36000, han: 11, fu: 30 },
    { label: '16000オール (役満)', pointsLabel: '16000オール', hanFuLabel: '役満', pts: 48000, han: 13, fu: 30 },
  ],
};

// 互換性維持のための従来のエイリアス
export const KO_RON_PRESETS = KO_RON_PRESETS_3X4;
export const OYA_RON_PRESETS = OYA_RON_PRESETS_3X4;
export const KO_TSUMO_PRESETS = KO_TSUMO_PRESETS_3X4;
export const OYA_TSUMO_PRESETS = OYA_TSUMO_PRESETS_3X4;

export const HAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 13];
export const FU_OPTIONS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
