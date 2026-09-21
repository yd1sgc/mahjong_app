import { describe, it, expect } from 'vitest';
import {
  erf,
  normalCdf,
  normalPdf,
  calculateSkillEstimation,
  calculateHeadToHeadEstimation,
} from '@/lib/mahjong/skillEstimation';
import { GameData } from '@/lib/mahjong/statsCalc';

describe('skillEstimation (実力推定・同卓時対戦分析)', () => {
  describe('数学・統計関数', () => {
    it('erf および normalCdf が標準正規分布の理論値と合致すること', () => {
      expect(erf(0)).toBe(0);
      expect(normalCdf(0)).toBeCloseTo(0.5, 5);

      // Z = 1.95996 で約 97.5%
      expect(normalCdf(1.95996)).toBeCloseTo(0.975, 3);
      // Z = -1.95996 で約 2.5%
      expect(normalCdf(-1.95996)).toBeCloseTo(0.025, 3);
      // Z = 1.0 で約 84.13%
      expect(normalCdf(1.0)).toBeCloseTo(0.8413, 3);
    });

    it('erf の対称性 erf(-x) = -erf(x) が成立すること', () => {
      expect(erf(-0.5)).toBeCloseTo(-erf(0.5), 7);
      expect(erf(-1.5)).toBeCloseTo(-erf(1.5), 7);
      expect(erf(-3.0)).toBeCloseTo(-erf(3.0), 7);
    });

    it('極端な外れ値 (Z = ±10) でオーバーフロー・アンダーフローせず飽和すること', () => {
      expect(normalCdf(10)).toBe(1);
      expect(normalCdf(-10)).toBe(0);
    });

    it('MMCの実測データ（85戦、平均5.16pt、標準偏差35.72）と確率が完全一致すること', () => {
      const avg = 5.16;
      const stdDev = 35.72;
      const n = 85;
      const se = stdDev / Math.sqrt(n); // 3.8744

      // MMC 表示値:
      // 実力「0」以上の確率：90.85%
      // 実力「1」以上の確率：85.85%
      // 実力「2」以上の確率：79.26%
      // 実力「3」以上の確率：71.14%
      // 実力「4」以上の確率：61.77%
      // 実力「5」以上の確率：51.65%
      const prob0 = normalCdf((avg - 0) / se) * 100;
      const prob1 = normalCdf((avg - 1) / se) * 100;
      const prob2 = normalCdf((avg - 2) / se) * 100;
      const prob3 = normalCdf((avg - 3) / se) * 100;
      const prob4 = normalCdf((avg - 4) / se) * 100;
      const prob5 = normalCdf((avg - 5) / se) * 100;

      expect(prob0).toBeCloseTo(90.85, 1);
      expect(prob1).toBeCloseTo(85.85, 1);
      expect(prob2).toBeCloseTo(79.26, 1);
      expect(prob3).toBeCloseTo(71.14, 1);
      expect(prob4).toBeCloseTo(61.77, 1);
      expect(prob5).toBeCloseTo(51.65, 1);
    });

    it('normalPdf の中心で最大値をとり、左右対称であること', () => {
      const mean = 5.0;
      const se = 2.0;
      const peak = normalPdf(5.0, mean, se);
      const left = normalPdf(3.0, mean, se);
      const right = normalPdf(7.0, mean, se);

      expect(peak).toBeGreaterThan(left);
      expect(peak).toBeGreaterThan(right);
      expect(left).toBeCloseTo(right, 6);
    });

    it('normalPdf は stdDev <= 0 のとき安全に 0 を返すこと', () => {
      expect(normalPdf(5.0, 5.0, 0)).toBe(0);
      expect(normalPdf(5.0, 5.0, -1)).toBe(0);
    });
  });

  describe('calculateSkillEstimation', () => {
    it('対局が存在しないプレイヤーは null を返すこと', () => {
      const res = calculateSkillEstimation([], 'プレイヤーA');
      expect(res).toBeNull();
    });

    it('指定プレイヤーの対局データから平均、標準偏差、確率、曲線を正しく計算すること', () => {
      const mockGames: GameData[] = [
        {
          game_id: 'g1',
          played_at: '2026-04-01',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: 'プレイヤーA', final_score: 50000, point: 50, rank: 1 },
            { seat: 1, member_id: 'm2', name: 'プレイヤーB', final_score: 30000, point: 10, rank: 2 },
            { seat: 2, member_id: 'm3', name: 'プレイヤーC', final_score: 15000, point: -20, rank: 3 },
            { seat: 3, member_id: 'm4', name: 'プレイヤーD', final_score: 5000, point: -40, rank: 4 },
          ],
        },
        {
          game_id: 'g2',
          played_at: '2026-04-02',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: 'プレイヤーA', final_score: 10000, point: -30, rank: 4 },
            { seat: 1, member_id: 'm2', name: 'プレイヤーB', final_score: 45000, point: 40, rank: 1 },
            { seat: 2, member_id: 'm3', name: 'プレイヤーC', final_score: 25000, point: 10, rank: 2 },
            { seat: 3, member_id: 'm4', name: 'プレイヤーD', final_score: 20000, point: -20, rank: 3 },
          ],
        },
      ];

      const res = calculateSkillEstimation(mockGames, 'プレイヤーA');
      expect(res).not.toBeNull();
      expect(res?.gameCount).toBe(2);
      // 平均: (50 + -30) / 2 = 10
      expect(res?.avgPt).toBe(10);
      // 平均順位: (1 + 4) / 2 = 2.5
      expect(res?.avgRank).toBe(2.5);
      // 分散: ((50 - 10)^2 + (-30 - 10)^2) / 1 = 1600 + 1600 = 3200
      // 標準偏差: sqrt(3200) ≈ 56.57
      expect(res?.stdDev).toBeCloseTo(56.57, 1);
      // 曲線データが41点存在すること
      expect(res?.curve.length).toBe(41);
    });

    it('境界値: 打荘数 N = 1 のとき不偏分散が0で安全に計算され、確率は100%または0%に倒れること', () => {
      const mockGames: GameData[] = [
        {
          game_id: 'g1',
          played_at: '2026-04-01',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: '新人', final_score: 40000, point: 2.5, rank: 2 },
            { seat: 1, member_id: 'm2', name: '相手', final_score: 20000, point: -2.5, rank: 3 },
          ],
        },
      ];

      const res = calculateSkillEstimation(mockGames, '新人');
      expect(res).not.toBeNull();
      expect(res?.gameCount).toBe(1);
      expect(res?.avgPt).toBe(2.5);
      expect(res?.stdDev).toBe(0);
      expect(res?.standardError).toBe(0);

      // targetPt <= 2.5 は 100%, > 2.5 は 0%
      const p0 = res?.probabilities.find((p) => p.targetPt === 0);
      const p1 = res?.probabilities.find((p) => p.targetPt === 1);
      const p2 = res?.probabilities.find((p) => p.targetPt === 2);
      const p3 = res?.probabilities.find((p) => p.targetPt === 3);

      expect(p0?.probability).toBe(100);
      expect(p1?.probability).toBe(100);
      expect(p2?.probability).toBe(100);
      expect(p3?.probability).toBe(0);

      // 曲線はすべて0で埋まること
      expect(res?.curve.every((pt) => pt.y === 0)).toBe(true);
    });
  });

  describe('calculateHeadToHeadEstimation', () => {
    it('同卓した相手との直接比較データおよび相手より強い確率を計算すること', () => {
      const mockGames: GameData[] = [
        {
          game_id: 'g1',
          played_at: '2026-04-01',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: '自分', final_score: 55000, point: 60, rank: 1 },
            { seat: 1, member_id: 'm2', name: 'ライバル', final_score: 5000, point: -40, rank: 4 },
            { seat: 2, member_id: 'm3', name: '他1', final_score: 25000, point: 0, rank: 2 },
            { seat: 3, member_id: 'm4', name: '他2', final_score: 15000, point: -20, rank: 3 },
          ],
        },
        {
          game_id: 'g2',
          played_at: '2026-04-02',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: '自分', final_score: 35000, point: 20, rank: 2 },
            { seat: 1, member_id: 'm2', name: 'ライバル', final_score: 20000, point: -10, rank: 3 },
            { seat: 2, member_id: 'm3', name: '他1', final_score: 45000, point: 40, rank: 1 },
            { seat: 3, member_id: 'm4', name: '他2', final_score: 0, point: -50, rank: 4 },
          ],
        },
      ];

      const res = calculateHeadToHeadEstimation(mockGames, '自分');
      expect(res.length).toBe(3); // ライバル, 他1, 他2

      const vsRival = res.find((r) => r.opponentName === 'ライバル');
      expect(vsRival).toBeDefined();
      expect(vsRival?.gameCount).toBe(2);
      expect(vsRival?.myAvgPt).toBe(40);
      expect(vsRival?.opponentAvgPt).toBe(-25);
      // 常に勝っているので相手より強い確率は 50% を大きく上回る
      expect(vsRival?.strongerThanOpponentProb).toBeGreaterThan(70);
    });

    it('境界値: 同卓時直接対決で完全に互角（pt差平均が0）の場合、優位確率は 50.0% になること', () => {
      const mockGames: GameData[] = [
        {
          game_id: 'g1',
          played_at: '2026-04-01',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: 'A', final_score: 40000, point: 20, rank: 1 },
            { seat: 1, member_id: 'm2', name: 'B', final_score: 20000, point: -20, rank: 4 },
          ],
        },
        {
          game_id: 'g2',
          played_at: '2026-04-02',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: 'A', final_score: 20000, point: -20, rank: 4 },
            { seat: 1, member_id: 'm2', name: 'B', final_score: 40000, point: 20, rank: 1 },
          ],
        },
      ];

      const res = calculateHeadToHeadEstimation(mockGames, 'A');
      const vsB = res.find((r) => r.opponentName === 'B');
      expect(vsB).toBeDefined();
      expect(vsB?.myAvgPt).toBe(0);
      expect(vsB?.opponentAvgPt).toBe(0);
      expect(vsB?.strongerThanOpponentProb).toBe(50);
    });

    it('境界値: 同卓時が1戦のみ (N = 1) の場合、勝った側は 100%、負けた側は 0% になること', () => {
      const mockGames: GameData[] = [
        {
          game_id: 'g1',
          played_at: '2026-04-01',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: '勝者', final_score: 50000, point: 50, rank: 1 },
            { seat: 1, member_id: 'm2', name: '敗者', final_score: 10000, point: -30, rank: 4 },
          ],
        },
      ];

      const resWin = calculateHeadToHeadEstimation(mockGames, '勝者');
      expect(resWin[0].strongerThanOpponentProb).toBe(100);

      const resLose = calculateHeadToHeadEstimation(mockGames, '敗者');
      expect(resLose[0].strongerThanOpponentProb).toBe(0);
    });

    it('境界値: 同卓者が存在しない場合は空配列を返すこと', () => {
      const mockGames: GameData[] = [
        {
          game_id: 'g1',
          played_at: '2026-04-01',
          rule_name: 'Mリーグ',
          group_id: 'grp1',
          rule_config: {},
          participants: [
            { seat: 0, member_id: 'm1', name: '他人のみ', final_score: 30000, point: 0, rank: 1 },
          ],
        },
      ];

      const res = calculateHeadToHeadEstimation(mockGames, '自分');
      expect(res).toEqual([]);
    });
  });
});
