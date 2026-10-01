import { describe, it, expect } from 'vitest';
import {
  calculateTobiBonus,
  calculateGameSettlement,
  sortByTurnDistance,
} from '@/lib/mahjong/rules';
import { RuleConfig, RoundRecord, WinType } from '@/types/mahjong';

function createRound(
  data: Partial<RoundRecord> & { kyoku_name: string; win_type: WinType }
): RoundRecord {
  return {
    winner: null,
    loser: null,
    score: 0,
    riichi: [],
    ...data,
  };
}

describe('飛び賞（トビ賞）計算ロジックの単体テスト', () => {
  const players = ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD']; // 東, 南, 西, 北

  describe('sortByTurnDistance (ツモ順距離ソート)', () => {
    it('西家から見た場合、北家→東家→南家の順にソートされること', () => {
      const sorted = sortByTurnDistance(players, 'PlayerC', ['PlayerA', 'PlayerB', 'PlayerD']);
      expect(sorted).toEqual(['PlayerD', 'PlayerA', 'PlayerB']);
    });

    it('東家から見た場合、南家→西家→北家の順にソートされること', () => {
      const sorted = sortByTurnDistance(players, 'PlayerA', ['PlayerD', 'PlayerC', 'PlayerB']);
      expect(sorted).toEqual(['PlayerB', 'PlayerC', 'PlayerD']);
    });
  });

  describe('calculateTobiBonus (純粋飛び賞算出)', () => {
    it('飛び賞未設定 (tobi_pt = 0) の場合、トビがいても全員0ptであること', () => {
      const scores = { PlayerA: 40000, PlayerB: 30000, PlayerC: 32000, PlayerD: -2000 };
      const ruleConfig: RuleConfig = {
        detail: { tobi_pt: 0 },
      };
      const lastRound = createRound({
        round_index: 3,
        kyoku_name: '東4局',
        win_type: 'ron',
        winner: 'PlayerA',
        loser: 'PlayerD',
        score: 8000,
      });

      const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
      expect(result).toEqual({ PlayerA: 0, PlayerB: 0, PlayerC: 0, PlayerD: 0 });
    });

    it('単独ロン和了でトビが発生した場合、放銃者が-tobi_pt、和了者が+tobi_ptとなること', () => {
      const scores = { PlayerA: 45000, PlayerB: 28000, PlayerC: 29000, PlayerD: -2000 };
      const ruleConfig: RuleConfig = {
        detail: { tobi_pt: 10 },
      };
      const lastRound = createRound({
        round_index: 3,
        kyoku_name: '東4局',
        win_type: 'ron',
        winner: 'PlayerA',
        loser: 'PlayerD',
        score: 8000,
      });

      const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
      expect(result).toEqual({
        PlayerA: 10,
        PlayerB: 0,
        PlayerC: 0,
        PlayerD: -10,
      });
      // ゼロサム検算
      const sum = Object.values(result).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum)).toBeLessThan(0.0001);
    });

    it('ツモ和了でトビが発生した場合、和了者が総取りすること', () => {
      const scores = { PlayerA: 50000, PlayerB: 27000, PlayerC: 25000, PlayerD: -2000 };
      const ruleConfig: RuleConfig = {
        detail: { tobi_pt: 10 },
      };
      const lastRound = createRound({
        round_index: 3,
        kyoku_name: '東4局',
        win_type: 'tsumo',
        winner: 'PlayerA',
        score: 12000,
      });

      const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
      expect(result).toEqual({
        PlayerA: 10,
        PlayerB: 0,
        PlayerC: 0,
        PlayerD: -10,
      });
    });

    it('親ツモ等で2名が同時にトビ（ダブルトビ）となった場合、それぞれから徴収されること', () => {
      const scores = { PlayerA: 62000, PlayerB: -1000, PlayerC: -1000, PlayerD: 40000 };
      const ruleConfig: RuleConfig = {
        detail: { tobi_pt: 10 },
      };
      const lastRound = createRound({
        round_index: 0,
        kyoku_name: '東1局',
        win_type: 'tsumo',
        winner: 'PlayerA',
        score: 24000,
      });

      const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
      expect(result).toEqual({
        PlayerA: 20,
        PlayerB: -10,
        PlayerC: -10,
        PlayerD: 0,
      });
      // ゼロサム検算
      const sum = Object.values(result).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum)).toBeLessThan(0.0001);
    });

    describe('ダブロン時の飛び賞配分', () => {
      it('頭ハネ設定 (atama_hane) の場合、放銃者に最も近い和了者が総取りすること', () => {
        // 放銃者: PlayerC(西家)、和了者: PlayerA(東家), PlayerB(南家)
        // 西家から見てツモ順は 北(D) -> 東(A) -> 南(B) なので、PlayerAが頭ハネ
        const scores = { PlayerA: 38000, PlayerB: 35000, PlayerC: -3000, PlayerD: 30000 };
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_multi_winner: 'atama_hane',
          },
        };
        const lastRound = createRound({
          round_index: 2,
          kyoku_name: '東3局',
          win_type: 'multi_ron',
          loser: 'PlayerC',
          multi_wins: [
            { winner: 'PlayerA', points_data: { total: 3900, han: 3, fu: 30 } },
            { winner: 'PlayerB', points_data: { total: 2600, han: 2, fu: 40 } },
          ],
        });

        const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
        expect(result).toEqual({
          PlayerA: 10,
          PlayerB: 0,
          PlayerC: -10,
          PlayerD: 0,
        });
      });

      it('折半設定 (split) で割り切れる場合、均等配分されること', () => {
        const scores = { PlayerA: 38000, PlayerB: 35000, PlayerC: -3000, PlayerD: 30000 };
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_multi_winner: 'split',
          },
        };
        const lastRound = createRound({
          round_index: 2,
          kyoku_name: '東3局',
          win_type: 'multi_ron',
          loser: 'PlayerC',
          multi_wins: [
            { winner: 'PlayerA', points_data: { total: 3900, han: 3, fu: 30 } },
            { winner: 'PlayerB', points_data: { total: 2600, han: 2, fu: 40 } },
          ],
        });

        const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
        expect(result).toEqual({
          PlayerA: 5,
          PlayerB: 5,
          PlayerC: -10,
          PlayerD: 0,
        });
      });

      it('折半設定 (split) で端数が出る場合、上家優先で配分されること', () => {
        // 放銃者: PlayerD(北家)、和了者3名: A(東), B(南), C(西)
        // 北家から見てツモ順は 東(A) -> 南(B) -> 西(C)
        // 10pt / 3 = 3.3pt, 余り 0.1pt -> A: 3.4pt, B: 3.3pt, C: 3.3pt
        const scores = { PlayerA: 38000, PlayerB: 35000, PlayerC: 32000, PlayerD: -5000 };
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_multi_winner: 'split',
          },
        };
        const lastRound = createRound({
          round_index: 3,
          kyoku_name: '東4局',
          win_type: 'multi_ron',
          loser: 'PlayerD',
          multi_wins: [
            { winner: 'PlayerB', points_data: { total: 2000, han: 2, fu: 30 } },
            { winner: 'PlayerA', points_data: { total: 3900, han: 3, fu: 30 } },
            { winner: 'PlayerC', points_data: { total: 1000, han: 1, fu: 30 } },
          ],
        });

        const result = calculateTobiBonus(players, scores, ruleConfig, lastRound);
        expect(result.PlayerD).toBe(-10);
        expect(result.PlayerA).toBe(3.4);
        expect(result.PlayerB).toBe(3.3);
        expect(result.PlayerC).toBe(3.3);

        const sum = Object.values(result).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum)).toBeLessThan(0.0001);
      });
    });

    describe('ノーテン罰符によるトビ', () => {
      const scores = { PlayerA: 38000, PlayerB: 35000, PlayerC: 29000, PlayerD: -2000 };
      const lastRound = createRound({
        round_index: 3,
        kyoku_name: '東4局',
        win_type: 'ryukyoku',
        tenpai: ['PlayerA', 'PlayerB'],
      });

      it('none設定の場合、飛び賞が発生しないこと', () => {
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_noten_rule: 'none',
          },
        };
        const result = calculateTobiBonus(players, scores, ruleConfig, lastRound, 'PlayerA');
        expect(result).toEqual({ PlayerA: 0, PlayerB: 0, PlayerC: 0, PlayerD: 0 });
      });

      it('top設定の場合、トッププレイヤーが総取りすること', () => {
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_noten_rule: 'top',
          },
        };
        const result = calculateTobiBonus(players, scores, ruleConfig, lastRound, 'PlayerA');
        expect(result).toEqual({ PlayerA: 10, PlayerB: 0, PlayerC: 0, PlayerD: -10 });
      });

      it('atama_hane設定の場合、飛んだ者から見て最も近い聴牌者が総取りすること', () => {
        // トビ者: PlayerD(北家)、聴牌: PlayerB(南家), PlayerC(西家)
        // 北家から見てツモ順は 東(A:ノーテン) -> 南(B:聴牌) -> 西(C:聴牌) なので、PlayerBが総取り
        const roundWithBC = createRound({
          round_index: 3,
          kyoku_name: '東4局',
          win_type: 'ryukyoku',
          tenpai: ['PlayerB', 'PlayerC'],
        });
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_noten_rule: 'atama_hane',
          },
        };
        const result = calculateTobiBonus(players, scores, ruleConfig, roundWithBC, 'PlayerA');
        expect(result).toEqual({ PlayerA: 0, PlayerB: 10, PlayerC: 0, PlayerD: -10 });
      });

      it('split設定の場合、聴牌者全員で配分されること', () => {
        const ruleConfig: RuleConfig = {
          detail: {
            tobi_pt: 10,
            tobi_noten_rule: 'split',
          },
        };
        const result = calculateTobiBonus(players, scores, ruleConfig, lastRound, 'PlayerA');
        expect(result).toEqual({ PlayerA: 5, PlayerB: 5, PlayerC: 0, PlayerD: -10 });
      });
    });
  });

  describe('calculateGameSettlement 統合精算テスト', () => {
    it('ウマオカ計算に飛び賞が正しく合算され、合計0.0pt（ゼロサム）を維持すること', () => {
      // 25000点持ち 30000点返し、ウマ [50, 10, -10, -30] (1位オカ +20pt = +70pt)
      // PlayerA: 45000点 (1位: +15pt + 50pt = +65.0pt)
      // PlayerB: 35000点 (2位: +5pt + 10pt = +15.0pt)
      // PlayerC: 22000点 (3位: -8pt - 10pt = -18.0pt)
      // PlayerD: -2000点 (4位: -32pt - 30pt = -62.0pt)
      // 飛び賞 20pt: D -> A (+20.0 / -20.0)
      // 最終pt: A: +85.0pt, B: +15.0pt, C: -18.0pt, D: -82.0pt
      const scores = { PlayerA: 45000, PlayerB: 35000, PlayerC: 22000, PlayerD: -2000 };
      const ruleConfig: RuleConfig = {
        basic: {
          init_score: 25000,
          return_score: 30000,
          uma: [50, 10, -10, -30],
        },
        detail: {
          tobi_pt: 20,
        },
      };
      const lastRound = createRound({
        round_index: 3,
        kyoku_name: '東4局',
        win_type: 'ron',
        winner: 'PlayerA',
        loser: 'PlayerD',
        score: 12000,
      });

      const settlement = calculateGameSettlement(players, scores, ruleConfig, 0, lastRound);

      expect(settlement).toHaveLength(4);
      const resA = settlement.find((s) => s.player === 'PlayerA')!;
      const resB = settlement.find((s) => s.player === 'PlayerB')!;
      const resC = settlement.find((s) => s.player === 'PlayerC')!;
      const resD = settlement.find((s) => s.player === 'PlayerD')!;

      expect(resA.tobiPoint).toBe(20);
      expect(resB.tobiPoint).toBe(0);
      expect(resC.tobiPoint).toBe(0);
      expect(resD.tobiPoint).toBe(-20);

      expect(resA.point).toBe(85);
      expect(resB.point).toBe(15);
      expect(resC.point).toBe(-18);
      expect(resD.point).toBe(-82);

      const totalPoint = settlement.reduce((sum, s) => sum + s.point, 0);
      expect(Math.round(totalPoint * 10) / 10).toBe(0);
    });

    it('飛び賞未指定の対局では既存の精算結果と完全一致すること', () => {
      const scores = { PlayerA: 35000, PlayerB: 30000, PlayerC: 25000, PlayerD: 10000 };
      const ruleConfig: RuleConfig = {
        basic: {
          init_score: 25000,
          return_score: 30000,
          uma: [50, 10, -10, -30],
        },
      };

      const settlement = calculateGameSettlement(players, scores, ruleConfig, 0);
      const resA = settlement.find((s) => s.player === 'PlayerA')!;
      expect(resA.tobiPoint).toBe(0);

      const totalPoint = settlement.reduce((sum, s) => sum + s.point, 0);
      expect(Math.round(totalPoint * 10) / 10).toBe(0);
    });
  });
});
