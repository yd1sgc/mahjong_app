/**
 * 主成分分析 (PCA) による雀風スタイル計算モジュール (pcaCalc.ts)
 * 11指標からヤコビ法により固有値・固有ベクトルを算出し、
 * 第1主成分 (PC1: 手役・仕掛け軸) および第2主成分 (PC2: 参加・粘り軸) を導出する純粋ドメイン関数群
 */

import { RoundStatsRow } from './statsCalc';

export interface PcaPlayerScore {
  name: string;
  kyokuCount: number;
  pc1: number;
  pc2: number;
  stats: RoundStatsRow;
}

export interface PcaFeatureLoading {
  name: string;
  pc1Loading: number;
  pc2Loading: number;
}

export interface PcaResult {
  players: PcaPlayerScore[];
  pc1Ratio: number;
  pc2Ratio: number;
  cumulativeRatio: number;
  featureLoadings: PcaFeatureLoading[];
  maxAbsScore: number;
}

export const PCA_FEATURE_NAMES = [
  '和了率',
  '放銃率',
  '流局聴牌率',
  '副露率',
  '立直率',
  'ダマ和了率',
  'ツモ率',
  '平均和了打点',
  '平均放銃打点',
  '副露時放銃率',
  '被立直時放銃率',
] as const;

/**
 * 対称行列の固有値・固有ベクトルを求めるヤコビ法 (Jacobi eigenvalue algorithm)
 */
export function jacobiEigenvalue(
  matrix: number[][],
  maxIter: number = 300
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  // 固有ベクトル行列 V を単位行列で初期化
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  const A: number[][] = matrix.map((row) => [...row]);

  for (let iter = 0; iter < maxIter; iter++) {
    // 非対角成分の最大値を探す
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const absVal = Math.abs(A[i][j]);
        if (absVal > maxVal) {
          maxVal = absVal;
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < 1e-10) {
      break;
    }

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = c * aip - s * aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * aip + c * aiq;
        A[q][i] = A[i][q];
      }
    }
    A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip - s * viq;
      V[i][q] = s * vip + c * viq;
    }
  }

  const eigenvalues = A.map((row, i) => row[i]);
  return { eigenvalues, eigenvectors: V };
}

/**
 * 局詳細成績配列から全11指標による主成分分析を実行
 */
export function calculatePcaStyles(players: RoundStatsRow[]): PcaResult | null {
  const m = players.length;
  const p = PCA_FEATURE_NAMES.length;

  // 主成分分析には最低3名のプレイヤーが必要
  if (m < 3) {
    return null;
  }

  // 1. 各プレイヤーから11特徴量を抽出
  const rawData: number[][] = players.map((row) => [
    row.agariRate,
    row.houjuRate,
    row.tenpaiRate,
    row.furoRate,
    row.riichiRate,
    row.damaAgariRate,
    row.tsumoRate,
    row.avgAgari,
    row.avgHouju,
    row.furoHoujuRate2,
    row.riichiHoujuRate,
  ]);

  // 2. 特徴量ごとの平均と標準偏差（標本標準偏差）
  const means: number[] = [];
  const stds: number[] = [];
  for (let j = 0; j < p; j++) {
    const vals = rawData.map((r) => r[j]);
    const mean = vals.reduce((a, b) => a + b, 0) / m;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (m - 1);
    const std = Math.sqrt(variance);
    means.push(mean);
    // 分散が極小または0の場合は標準偏差1として0除算を防止
    stds.push(std > 1e-8 ? std : 1);
  }

  // 3. 標準化データ行列 Z (m x p)
  const Z: number[][] = rawData.map((row) =>
    row.map((val, j) => (val - means[j]) / stds[j])
  );

  // 4. 相関行列 R (p x p) = (Z^T * Z) / (m - 1)
  const R: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let j1 = 0; j1 < p; j1++) {
    for (let j2 = 0; j2 < p; j2++) {
      let sum = 0;
      for (let i = 0; i < m; i++) {
        sum += Z[i][j1] * Z[i][j2];
      }
      R[j1][j2] = sum / (m - 1);
    }
  }

  // 5. ヤコビ法による固有値分解
  const { eigenvalues, eigenvectors } = jacobiEigenvalue(R);

  // 固有値降順ソート
  const sortedIndices = eigenvalues
    .map((val, idx) => ({ val: Math.max(0, val), idx }))
    .sort((a, b) => b.val - a.val);

  const totalVar = sortedIndices.reduce((acc, item) => acc + item.val, 0);
  if (totalVar <= 0) {
    return null;
  }

  const pc1Idx = sortedIndices[0].idx;
  const pc2Idx = sortedIndices[1].idx;

  const pc1Val = sortedIndices[0].val;
  const pc2Val = sortedIndices[1].val;

  const pc1Ratio = Math.round((pc1Val / totalVar) * 1000) / 10;
  const pc2Ratio = Math.round((pc2Val / totalVar) * 1000) / 10;
  const cumulativeRatio = Math.round((pc1Ratio + pc2Ratio) * 10) / 10;

  // 固有ベクトル（各行iにおけるj番目の主成分への重み）
  const pc1Vector = eigenvectors.map((row) => row[pc1Idx]);
  const pc2Vector = eigenvectors.map((row) => row[pc2Idx]);

  // 因子負荷量 (固有ベクトル * sqrt(固有値))
  const pc1Sqrt = Math.sqrt(pc1Val);
  const pc2Sqrt = Math.sqrt(pc2Val);
  const rawPc1Loadings = pc1Vector.map((v) => v * pc1Sqrt);
  const rawPc2Loadings = pc2Vector.map((v) => v * pc2Sqrt);

  // 軸の意味付けと符号標準化:
  // PC1は「平均和了打点」の負荷量が正になるように反転（右＝面前・重厚高打点、左＝副露・安手スピード）
  const avgAgariIdx = PCA_FEATURE_NAMES.indexOf('平均和了打点');
  const pc1Sign = rawPc1Loadings[avgAgariIdx] >= 0 ? 1 : -1;

  // PC2は「和了率」の負荷量が正になるように反転（上＝積極参加・高和了、下＝慎重守備・受け）
  const agariRateIdx = PCA_FEATURE_NAMES.indexOf('和了率');
  const pc2Sign = rawPc2Loadings[agariRateIdx] >= 0 ? 1 : -1;

  const pc1Loadings = rawPc1Loadings.map((l) => Math.round(l * pc1Sign * 1000) / 1000);
  const pc2Loadings = rawPc2Loadings.map((l) => Math.round(l * pc2Sign * 1000) / 1000);

  const featureLoadings: PcaFeatureLoading[] = PCA_FEATURE_NAMES.map((name, i) => ({
    name,
    pc1Loading: pc1Loadings[i],
    pc2Loading: pc2Loadings[i],
  }));

  // 6. 各プレイヤーの主成分得点を計算 (score = Z * vector * sign)
  let maxAbsScore = 2.0;

  const playerScores: PcaPlayerScore[] = players.map((pRow, i) => {
    let score1 = 0;
    let score2 = 0;
    for (let j = 0; j < p; j++) {
      score1 += Z[i][j] * pc1Vector[j];
      score2 += Z[i][j] * pc2Vector[j];
    }
    score1 *= pc1Sign;
    score2 *= pc2Sign;

    const roundedPc1 = Math.round(score1 * 100) / 100;
    const roundedPc2 = Math.round(score2 * 100) / 100;

    const abs1 = Math.abs(roundedPc1);
    const abs2 = Math.abs(roundedPc2);
    if (abs1 > maxAbsScore) maxAbsScore = abs1;
    if (abs2 > maxAbsScore) maxAbsScore = abs2;

    return {
      name: pRow.name,
      kyokuCount: pRow.kyokuCount,
      pc1: roundedPc1,
      pc2: roundedPc2,
      stats: pRow,
    };
  });

  return {
    players: playerScores,
    pc1Ratio,
    pc2Ratio,
    cumulativeRatio,
    featureLoadings,
    maxAbsScore: Math.ceil(maxAbsScore * 10) / 10,
  };
}
