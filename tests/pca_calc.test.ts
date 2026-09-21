import { describe, it, expect } from 'vitest';
import { jacobiEigenvalue, calculatePcaStyles } from '@/lib/mahjong/pcaCalc';
import { RoundStatsRow } from '@/lib/mahjong/statsCalc';

describe('pcaCalc - ヤコビ法固有値分解と主成分分析', () => {
  it('jacobiEigenvalue が対称行列の固有値を正しく計算すること', () => {
    // 既知の対称行列: A = [[2, 1], [1, 2]]
    // 固有値は 3 と 1
    const matrix = [
      [2, 1],
      [1, 2],
    ];
    const { eigenvalues, eigenvectors } = jacobiEigenvalue(matrix);
    const sorted = [...eigenvalues].sort((a, b) => b - a);

    expect(sorted[0]).toBeCloseTo(3.0, 4);
    expect(sorted[1]).toBeCloseTo(1.0, 4);

    // 固有ベクトルの直交性確認 V * V^T = I
    const v1 = eigenvectors.map((r) => r[0]);
    const v2 = eigenvectors.map((r) => r[1]);
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    expect(dot).toBeCloseTo(0.0, 4);
  });

  it('プレイヤーが2名以下の場合は null を返すこと', () => {
    const players: RoundStatsRow[] = [
      {
        name: 'A',
        kyokuCount: 100,
        agariRate: 25,
        tsumoRate: 40,
        houjuRate: 10,
        agariHoujuDiff: 15,
        tenpaiRate: 50,
        notenBappu: 1000,
        kyotakuPoint: 0,
        avgAgari: 6500,
        riichiAvgAgari: 7500,
        furoAvgAgari: 5000,
        damaAvgAgari: 6000,
        efficiency: 1.2,
        kyokuShuuchi: 100,
        riichiHoujuRate: 30,
        furoHoujuRate: 20,
        damaHoujuRate: 10,
        avgHouju: 5500,
        riichiRate: 20,
        riichiAgariRate: 50,
        riichiHoujuRate2: 15,
        furoRate: 30,
        furoAgariRate: 40,
        furoHoujuRate2: 20,
        damaAgariRate: 20,
        oyaKyoku: 25,
        koKyoku: 75,
        oyaRenchanRate: 30,
        oyaKyokuShuuchi: 200,
        koKyokuShuuchi: 50,
        oyaAgariRate: 25,
        koAgariRate: 25,
        oyaHoujuRate: 10,
        koHoujuRate: 10,
        oyaAvgAgariPt: 8000,
        koAvgAgariPt: 6000,
      },
    ];

    expect(calculatePcaStyles(players)).toBeNull();
  });

  it('3名以上の実戦データに対してPC1・PC2スコアおよび寄与率を正しく計算すること', () => {
    const dummyPlayer = (name: string, diff1: number, diff2: number): RoundStatsRow => ({
      name,
      kyokuCount: 200,
      agariRate: 20 + diff1 * 2,
      tsumoRate: 40 + diff2,
      houjuRate: 12 - diff1 + diff2,
      agariHoujuDiff: 8 + diff1 * 3,
      tenpaiRate: 45 + diff2 * 2,
      notenBappu: 1000 * diff1,
      kyotakuPoint: 500 * diff2,
      avgAgari: 6000 + diff1 * 400 - diff2 * 300,
      riichiAvgAgari: 7000 + diff1 * 300,
      furoAvgAgari: 5000 + diff2 * 200,
      damaAvgAgari: 5800 + diff1 * 200,
      efficiency: 1.1 + diff1 * 0.1,
      kyokuShuuchi: diff1 * 200,
      riichiHoujuRate: 25 - diff2,
      furoHoujuRate: 20 - diff1,
      damaHoujuRate: 10 - diff2,
      avgHouju: 5200 - diff1 * 100,
      riichiRate: 18 + diff1 * 1.5,
      riichiAgariRate: 50 + diff2,
      riichiHoujuRate2: 12 - diff1 * 0.5,
      furoRate: 30 - diff2 * 2,
      furoAgariRate: 40 + diff1,
      furoHoujuRate2: 18 - diff2,
      damaAgariRate: 20 - diff1,
      oyaKyoku: 50,
      koKyoku: 150,
      oyaRenchanRate: 35 + diff1 * 2,
      oyaKyokuShuuchi: diff1 * 300,
      koKyokuShuuchi: diff1 * 100,
      oyaAgariRate: 25 + diff1 * 2,
      koAgariRate: 20 + diff1 * 2,
      oyaHoujuRate: 10 - diff1,
      koHoujuRate: 12 - diff1,
      oyaAvgAgariPt: 9000 + diff1 * 300,
      koAvgAgariPt: 6000 + diff1 * 200,
    });

    const players: RoundStatsRow[] = [
      dummyPlayer('プレイヤーA', -2, 1),
      dummyPlayer('プレイヤーB', -1, -2),
      dummyPlayer('プレイヤーC', 0, 2),
      dummyPlayer('プレイヤーD', 1, -1),
      dummyPlayer('プレイヤーE', 2, 0),
    ];

    const result = calculatePcaStyles(players);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.players.length).toBe(5);
    expect(result.pc1Ratio).toBeGreaterThan(0);
    expect(result.pc2Ratio).toBeGreaterThan(0);
    expect(result.cumulativeRatio).toBeGreaterThan(0);
    expect(result.cumulativeRatio).toBeLessThanOrEqual(100);
    expect(result.featureLoadings.length).toBe(11);
    expect(result.maxAbsScore).toBeGreaterThanOrEqual(1.0);

    // プレイヤーのPCスコアが存在すること
    result.players.forEach((p) => {
      expect(typeof p.pc1).toBe('number');
      expect(typeof p.pc2).toBe('number');
      expect(Number.isNaN(p.pc1)).toBe(false);
      expect(Number.isNaN(p.pc2)).toBe(false);
    });
  });
});
