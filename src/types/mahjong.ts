/**
 * 麻雀ドメインの基本型定義
 * UIおよびデータベース（Supabase）から完全に独立した純粋な型
 */

/** 対局の基本ルール設定 */
export interface BasicRuleConfig {
  /** 配給原点（初期持ち点、例: 25000） */
  init_score?: number;
  /** 返し点（基準点、例: 30000） */
  return_score?: number;
  /** 順位ウマ（例: [50, 10, -10, -30]） */
  uma?: number[];
  /** 試合長 ('hanchan' | 'tonpu') */
  game_length?: 'hanchan' | 'tonpu';
}

/** 対局の詳細ルール設定 */
export interface DetailRuleConfig {
  /** 本場ごとの加算点（例: 300） */
  honba_pt?: number;
  /** リーチ棒の点数（例: 1000） */
  riichi_pt?: number;
  /** ノーテン罰符の場全体の合計点（例: 3000） */
  noten_bappu_pt?: number;
  /** 満貫の基本点（チョンボ支払計算用、例: 8000） */
  mangan_base_pt?: number;
  /** チョンボ時の精算方式 ('mangan_pay': 満貫払い, 'pt_penalty': 最終ポイント減点) */
  chombo_rule?: 'mangan_pay' | 'pt_penalty';
  /** チョンボ減点時のペナルティpt（例: 20） */
  chombo_pt?: number;
  /** 連荘条件 ('tenpai': テンパイ連荘, 'agari': 和了連荘, 'noten': 常に連荘) */
  renchan_rule?: 'tenpai' | 'agari' | 'noten';
  /** 飛び終了条件 ('under_zero': 0点未満, 'zero_or_less': 0点以下, 'none': トビなし) */
  tobi_end?: 'under_zero' | 'zero_or_less' | 'none';
  /** 西入・延長条件 ('under_30000': 30000点未満で延長, 'none' | 'fixed_nan4': 南4局で打ち切り) */
  west_extension?: 'under_30000' | 'none' | 'fixed_nan4';
  /** 親トップ時のアガリやめ (true / false) */
  agari_yame?: boolean;
  /** 親トップ時のテンパイやめ (true / false) */
  tenpai_yame?: boolean;
  /** 途中流局時の連荘設定 ('renchan' | 'ryukyoku') */
  kyushu?: 'renchan' | 'ryukyoku';
  [key: string]: unknown;
}

/** ルール設定全体 */
export interface RuleConfig {
  rule_name?: string;
  basic?: BasicRuleConfig;
  detail?: DetailRuleConfig;
  // basic設定がルートにフラットに配置されている場合の互換性対応
  init_score?: number;
  return_score?: number;
  uma?: number[];
  game_length?: 'hanchan' | 'tonpu';
  [key: string]: unknown;
}

/** 点数計算結果 */
export interface ScoreResult {
  /** 和了者が受け取る合計点（供託・本場を除く純粋なアガリ点） */
  total: number;
  /** 子ツモ時に親が支払う点数（親ツモ時またはロン時は0） */
  dealerPay: number;
  /** ツモ時に子が支払う点数（親ツモ時は子全員が同額支払い、ロン時は0） */
  nonDealerPay: number;
}

/** 局の結果種別 */
export type WinType =
  | 'ron'
  | 'tsumo'
  | 'ryukyoku'
  | 'chombo'
  | 'multi_ron'
  | 'mid_ryukyoku';

/** ダブロン・トリプルロンの各和了者情報 */
export interface MultiWinDetail {
  winner: string;
  points_data: {
    total: number;
  };
}

/** 局の結果レコード */
export interface RoundRecord {
  kyoku_name: string;
  winner: string | null;
  loser: string | null;
  win_type: WinType;
  score: number;
  riichi: string[];
  furo?: string[];
  tenpai?: string[];
  starting_riichi_sticks?: number;
  honba?: number;
  multi_wins?: MultiWinDetail[];
  ryukyoku_type?: string;
}

/** 対局状態スナップショット */
export interface GameStateSnapshot {
  players: string[];
  scores: Record<string, number>;
  roundIdx: number;
  honba: number;
  riichiStick: number;
  roundHistory: RoundRecord[];
  riichiDeclared: string[];
  furoDeclared: string[];
}
