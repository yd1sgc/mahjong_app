/**
 * 麻雀の純粋点数計算モジュール
 * 翻・符からのアガリ点数計算、ウマオカ計算、オカなし計算
 * （React/Supabase完全非依存）
 */

import { RuleConfig, ScoreResult } from '@/types/mahjong';

/** デフォルト設定値 */
export const DEFAULT_RETURN_SCORE = 30000;
export const DEFAULT_INIT_SCORE = 25000;
export const DEFAULT_UMA = [50, 10, -10, -30];

/**
 * 100点単位での切り上げ
 * @param n 計算基本値
 * @returns 100点単位に切り上げた値
 */
export function roundUp100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

/**
 * 小数第1位までの四捨五入（浮動小数点誤差の除去）
 * @param val 計算値
 * @returns 小数第1位までの数値
 */
export function roundTo1Decimal(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * 翻数・符数から和了点数を計算する純粋関数
 * （切り上げ満貫非適用・5翻未満の計算および役満対応）
 *
 * @param han 翻数 (1〜)
 * @param fu 符数 (20〜)
 * @param isDealer 親かどうか
 * @param isTsumo ツモ和了かどうか
 * @returns ScoreResult { total, dealerPay, nonDealerPay }
 */
export function calculateScore(
  han: number,
  fu: number,
  isDealer: boolean,
  isTsumo: boolean
): ScoreResult {
  let base: number;

  if (han < 5) {
    const basicPoints = fu * Math.pow(2, 2 + han);
    // 切り上げ満貫なし: 基本点が2000以上で満貫打ち止め
    base = basicPoints >= 2000 ? 2000 : basicPoints;
  } else if (han < 6) {
    base = 2000; // 満貫
  } else if (han < 8) {
    base = 3000; // 跳満
  } else if (han < 11) {
    base = 4000; // 倍満
  } else if (han < 13) {
    base = 6000; // 三倍満
  } else if (han < 26) {
    base = 8000; // 役満
  } else {
    base = 16000; // 二倍役満 / 数え役満
  }

  if (isTsumo) {
    if (isDealer) {
      // 親ツモ: 子全員が roundUp(base * 2) を支払う
      const pay = roundUp100(base * 2);
      return {
        total: pay * 3,
        dealerPay: 0,
        nonDealerPay: pay,
      };
    } else {
      // 子ツモ: 親が roundUp(base * 2)、他2名の子が roundUp(base) を支払う
      const oyaPay = roundUp100(base * 2);
      const koPay = roundUp100(base);
      return {
        total: oyaPay + koPay * 2,
        dealerPay: oyaPay,
        nonDealerPay: koPay,
      };
    }
  } else {
    // ロン和了: 放銃者が全額支払う
    const total = isDealer ? roundUp100(base * 6) : roundUp100(base * 4);
    return {
      total,
      dealerPay: 0,
      nonDealerPay: 0,
    };
  }
}

/**
 * 確定持ち点と順位からウマ・オカを含む最終ポイントを計算
 *
 * @param score 確定素点（例: 35000）
 * @param rank 順位（1〜4）
 * @param ruleConfig ルール設定（未指定時はデフォルトの30000点返し、ウマ[50, 10, -10, -30]）
 * @param chomboCount チョンボ回数（ポイント減点方式の場合のみ適用）
 * @returns 算出ポイント（小数第1位）
 */
export function calcPoint(
  score: number,
  rank: number,
  ruleConfig?: RuleConfig | null,
  chomboCount: number = 0
): number {
  let chomboPenalty = 0;
  let returnScore = DEFAULT_RETURN_SCORE;
  let umaList = DEFAULT_UMA;

  if (ruleConfig) {
    const bCfg = ruleConfig.basic || ruleConfig;
    const dCfg = ruleConfig.detail || {};

    if (dCfg.chombo_rule === 'pt_penalty') {
      const penaltyPerChombo = dCfg.chombo_pt ?? 20;
      chomboPenalty = penaltyPerChombo * chomboCount;
    }

    if (bCfg.return_score !== undefined) {
      returnScore = bCfg.return_score;
    }
    if (bCfg.uma && Array.isArray(bCfg.uma)) {
      umaList = bCfg.uma;
    }
  }

  const umaPt = rank >= 1 && rank <= umaList.length ? umaList[rank - 1] : 0;
  const basePt = (score - returnScore) / 1000;
  const total = basePt + umaPt - chomboPenalty;

  return roundTo1Decimal(total);
}

/**
 * オカなし設定時のポイント計算（配給原点＝返し点での計算）
 *
 * @param score 確定持ち点
 * @param rank 順位（1〜4）
 * @returns 算出ポイント（小数第1位）
 */
export function calcOkaNashiPoint(score: number, rank: number): number {
  const oka = ((DEFAULT_RETURN_SCORE - DEFAULT_INIT_SCORE) * 4) / 1000; // (30000 - 25000) * 4 / 1000 = 20.0
  const basePt = (score - DEFAULT_INIT_SCORE) / 1000;
  const umaSetting = DEFAULT_UMA[rank - 1] ?? 0;
  const umaPt = umaSetting - (rank === 1 ? oka : 0);
  const total = basePt + umaPt;

  return roundTo1Decimal(total);
}
