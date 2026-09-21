/**
 * 麻雀 実力推定・同卓時対戦分析ドメイン層 (skillEstimation.ts)
 * MMC (mahjong-manage.com) 準拠の統計モデル
 * 中心極限定理に基づく正規分布・標準誤差・期待収支の統計的推定
 */

import { GameData } from './statsCalc';

// ─── 数学・統計ヘルパー（副作用のない純粋関数） ───

/**
 * 誤差関数 erf(x) の高精度多項式近似 (Abramowitz & Stegun 7.1.26 準拠)
 * 最大誤差: 1.5e-7
 */
export function erf(x: number): number {
  if (x === 0) return 0;
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1.0 / (1.0 + p * absX);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const y = 1.0 - poly * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * 標準正規分布の累積分布関数 CDF: Φ(z)
 */
export function normalCdf(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * 正規分布の確率密度関数 PDF: f(x; μ, σ)
 */
export function normalPdf(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0;
  const factor = 1.0 / (stdDev * Math.sqrt(2 * Math.PI));
  const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
  return factor * Math.exp(exponent);
}

// ─── 型定義 ───

export interface SkillEstimationSummary {
  playerName: string;
  gameCount: number;
  avgPt: number;
  avgRank: number;
  stdDev: number; // 標本標準偏差 s
  standardError: number; // 平均値の標準誤差 SE = s / sqrt(N)
  probabilities: { targetPt: number; probability: number }[]; // 実力「X」以上の確率 (%)
  curve: { x: number; y: number }[]; // -10 ~ +10 の確率密度曲線
}

export interface HeadToHeadSummary {
  opponentName: string;
  gameCount: number;
  myAvgPt: number;
  myAvgRank: number;
  opponentAvgPt: number;
  opponentAvgRank: number;
  myStdDev: number;
  opponentStdDev: number;
  myStandardError: number;
  opponentStandardError: number;
  strongerThanOpponentProb: number; // 相手より強い確率 (%)
  myCurve: { x: number; y: number }[];
  opponentCurve: { x: number; y: number }[];
}

// グラフ生成レンジ: -10pt ~ +10pt (刻み幅 0.5)
const GRAPH_X_MIN = -10;
const GRAPH_X_MAX = 10;
const GRAPH_STEP = 0.5;

function generateDistributionCurve(mean: number, se: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  if (se <= 0) {
    for (let x = GRAPH_X_MIN; x <= GRAPH_X_MAX + 1e-6; x += GRAPH_STEP) {
      points.push({ x, y: 0 });
    }
    return points;
  }
  for (let x = GRAPH_X_MIN; x <= GRAPH_X_MAX + 1e-6; x += GRAPH_STEP) {
    points.push({
      x: Math.round(x * 10) / 10,
      y: normalPdf(x, mean, se),
    });
  }
  return points;
}

// ─── ドメイン集計関数 ───

/**
 * 単一プレイヤーのトータル実力推定を計算
 */
export function calculateSkillEstimation(
  games: GameData[],
  playerName: string
): SkillEstimationSummary | null {
  const ptList: number[] = [];
  const rankList: number[] = [];

  for (const game of games) {
    const participant = game.participants.find((p) => p.name === playerName);
    if (participant) {
      ptList.push(participant.point);
      rankList.push(participant.rank);
    }
  }

  const n = ptList.length;
  if (n === 0) return null;

  // 平均
  const avgPt = ptList.reduce((sum, p) => sum + p, 0) / n;
  const avgRank = rankList.reduce((sum, r) => sum + r, 0) / n;

  // 標本標準偏差 (不偏分散の平方根)
  let stdDev = 0;
  if (n > 1) {
    const variance = ptList.reduce((sum, p) => sum + Math.pow(p - avgPt, 2), 0) / (n - 1);
    stdDev = Math.sqrt(variance);
  }

  // 標準誤差
  const standardError = n > 0 ? stdDev / Math.sqrt(n) : 0;

  // 実力 X 以上の確率 (%) X = 0, 1, 2, 3, 4, 5
  const targets = [0, 1, 2, 3, 4, 5];
  const probabilities = targets.map((targetPt) => {
    if (standardError <= 0) {
      return { targetPt, probability: avgPt >= targetPt ? 100 : 0 };
    }
    const z = (targetPt - avgPt) / standardError;
    const prob = (1.0 - normalCdf(z)) * 100;
    return {
      targetPt,
      probability: Math.round(prob * 100) / 100,
    };
  });

  // 確率密度曲線
  const curve = generateDistributionCurve(avgPt, standardError);

  return {
    playerName,
    gameCount: n,
    avgPt: Math.round(avgPt * 100) / 100,
    avgRank: Math.round(avgRank * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    standardError: Math.round(standardError * 100) / 100,
    probabilities,
    curve,
  };
}

/**
 * 基準プレイヤーと各対戦相手との同卓時実力比較を計算
 */
export function calculateHeadToHeadEstimation(
  games: GameData[],
  myPlayerName: string
): HeadToHeadSummary[] {
  // 相手プレイヤーごとの同卓対局データを収集
  const opponentMap = new Map<
    string,
    {
      myPts: number[];
      myRanks: number[];
      oppPts: number[];
      oppRanks: number[];
      diffs: number[]; // myPt - oppPt
    }
  >();

  for (const game of games) {
    const myParticipant = game.participants.find((p) => p.name === myPlayerName);
    if (!myParticipant) continue;

    for (const p of game.participants) {
      if (p.name === myPlayerName) continue;
      const oppName = p.name;

      if (!opponentMap.has(oppName)) {
        opponentMap.set(oppName, {
          myPts: [],
          myRanks: [],
          oppPts: [],
          oppRanks: [],
          diffs: [],
        });
      }

      const data = opponentMap.get(oppName)!;
      data.myPts.push(myParticipant.point);
      data.myRanks.push(myParticipant.rank);
      data.oppPts.push(p.point);
      data.oppRanks.push(p.rank);
      data.diffs.push(myParticipant.point - p.point);
    }
  }

  const results: HeadToHeadSummary[] = [];

  for (const [opponentName, data] of opponentMap.entries()) {
    const n = data.diffs.length;
    if (n === 0) continue;

    const myAvgPt = data.myPts.reduce((s, x) => s + x, 0) / n;
    const myAvgRank = data.myRanks.reduce((s, x) => s + x, 0) / n;
    const oppAvgPt = data.oppPts.reduce((s, x) => s + x, 0) / n;
    const oppAvgRank = data.oppRanks.reduce((s, x) => s + x, 0) / n;

    // 自分の分散・SE
    let myStdDev = 0;
    if (n > 1) {
      const myVar = data.myPts.reduce((s, x) => s + Math.pow(x - myAvgPt, 2), 0) / (n - 1);
      myStdDev = Math.sqrt(myVar);
    }
    const mySe = n > 0 ? myStdDev / Math.sqrt(n) : 0;

    // 相手の分散・SE
    let oppStdDev = 0;
    if (n > 1) {
      const oppVar = data.oppPts.reduce((s, x) => s + Math.pow(x - oppAvgPt, 2), 0) / (n - 1);
      oppStdDev = Math.sqrt(oppVar);
    }
    const oppSe = n > 0 ? oppStdDev / Math.sqrt(n) : 0;

    // 差分の統計量 (対応のあるt検定基準)
    const avgDiff = myAvgPt - oppAvgPt;
    let diffStdDev = 0;
    if (n > 1) {
      const diffVar = data.diffs.reduce((s, x) => s + Math.pow(x - avgDiff, 2), 0) / (n - 1);
      diffStdDev = Math.sqrt(diffVar);
    }
    const diffSe = n > 0 ? diffStdDev / Math.sqrt(n) : 0;

    // 相手より強い確率: P(avgDiff > 0) = Φ(avgDiff / diffSe)
    let strongerProb = 50.0;
    if (diffSe > 0) {
      const z = avgDiff / diffSe;
      strongerProb = normalCdf(z) * 100;
    } else if (avgDiff > 0) {
      strongerProb = 100.0;
    } else if (avgDiff < 0) {
      strongerProb = 0.0;
    }

    results.push({
      opponentName,
      gameCount: n,
      myAvgPt: Math.round(myAvgPt * 100) / 100,
      myAvgRank: Math.round(myAvgRank * 100) / 100,
      opponentAvgPt: Math.round(oppAvgPt * 100) / 100,
      opponentAvgRank: Math.round(oppAvgRank * 100) / 100,
      myStdDev: Math.round(myStdDev * 100) / 100,
      opponentStdDev: Math.round(oppStdDev * 100) / 100,
      myStandardError: Math.round(mySe * 100) / 100,
      opponentStandardError: Math.round(oppSe * 100) / 100,
      strongerThanOpponentProb: Math.round(strongerProb * 100) / 100,
      myCurve: generateDistributionCurve(myAvgPt, mySe),
      opponentCurve: generateDistributionCurve(oppAvgPt, oppSe),
    });
  }

  // 同卓数降順でソート
  return results.sort((a, b) => b.gameCount - a.gameCount);
}
