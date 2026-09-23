import { describe, it, expect } from 'vitest';
import {
  computeRoundSeatDetails,
  computeAllRoundsDetails,
  recalculateState,
} from '@/lib/mahjong/rules';
import { RoundRecord, RuleConfig } from '@/types/mahjong';

describe('computeRoundSeatDetails (内訳整合性恒等式検証)', () => {
  const players = ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD'];
  const ruleConfig: RuleConfig = {
    basic: { init_score: 25000 },
    detail: { honba_pt: 300, riichi_pt: 1000, noten_bappu_pt: 3000 },
  };

  it('ロン和了: 和了者立直あり・放銃者立直あり・他家立直あり・供託持ち越しあり', () => {
    // 局前状態: 持ち越し供託2本 (2000点), 1本場
    const startRiichiSticks = 2;
    const startHonba = 1;
    const scoresBefore = {
      PlayerA: 25000,
      PlayerB: 25000,
      PlayerC: 25000,
      PlayerD: 25000,
    };

    // Aが和了(8000点), Bが放銃, A/B/Cが立直
    const round: RoundRecord = {
      round_index: 0,
      kyoku_name: '東1局',
      honba: 1,
      win_type: 'ron',
      winner: 'PlayerA',
      loser: 'PlayerB',
      score: 8000,
      riichi: ['PlayerA', 'PlayerB', 'PlayerC'],
      tenpai: ['PlayerA', 'PlayerB', 'PlayerC'],
    };

    // 画面スコア再計算ロジックによる scoresAfter
    const snapshot = recalculateState(
      players,
      25000,
      ruleConfig,
      [round],
      []
    );
    // ただし直前状態をシミュレーションするため、1局のみの増減を手動算出
    // A: 25000 - 1000(立直) + 8000(素点) + 300(本場) + (2 + 3)*1000(供託全回収) = 37300 (delta: +12300)
    // B: 25000 - 1000(立直) - 8000(素点) - 300(本場) = 15700 (delta: -9300)
    // C: 25000 - 1000(立直) = 24000 (delta: -1000)
    // D: 25000 (delta: 0)
    const scoresAfter = {
      PlayerA: 37300,
      PlayerB: 15700,
      PlayerC: 24000,
      PlayerD: 25000,
    };

    const details = computeRoundSeatDetails({
      players,
      round,
      startRiichiSticks,
      startHonba,
      scoresBefore,
      scoresAfter,
      ruleConfig,
    });

    for (const d of details) {
      const sum = d.basePoint + d.honbaPoint + d.kyotakuPoint + d.penaltyPoint;
      expect(sum).toBe(d.scoreDelta);
    }

    const a = details.find((d) => d.player === 'PlayerA')!;
    expect(a.basePoint).toBe(8000);
    expect(a.honbaPoint).toBe(300);
    expect(a.kyotakuPoint).toBe(4000); // 総供託5000点 - 自身立直1000点 = +4000点
    expect(a.penaltyPoint).toBe(0);
    expect(a.scoreDelta).toBe(12300);

    const b = details.find((d) => d.player === 'PlayerB')!;
    expect(b.basePoint).toBe(-8000);
    expect(b.honbaPoint).toBe(-300);
    expect(b.kyotakuPoint).toBe(-1000);
    expect(b.scoreDelta).toBe(-9300);

    const c = details.find((d) => d.player === 'PlayerC')!;
    expect(c.basePoint).toBe(0);
    expect(c.honbaPoint).toBe(0);
    expect(c.kyotakuPoint).toBe(-1000);
    expect(c.scoreDelta).toBe(-1000);

    const d = details.find((d) => d.player === 'PlayerD')!;
    expect(d.basePoint).toBe(0);
    expect(d.honbaPoint).toBe(0);
    expect(d.kyotakuPoint).toBe(0);
    expect(d.scoreDelta).toBe(0);
  });

  it('ツモ和了: 子ツモ満貫 (親4000/子2000), 2本場, 持ち越し供託なし, A立直ツモ, D立直', () => {
    const startRiichiSticks = 0;
    const startHonba = 2; // 本場点: 各自 2 * 100 = 200点
    const scoresBefore = {
      PlayerA: 25000, // 子 (東2局等)
      PlayerB: 25000, // 親
      PlayerC: 25000, // 子
      PlayerD: 25000, // 子
    };

    // Aがツモ(8000点), AとDが立直 (総供託2000点)
    // A: -1000 + 8000 + 600(本場計) + 2000 = +9600 (net: 34600)
    // B (親): -4000 - 200 = -4200 (net: 20800)
    // C (子): -2000 - 200 = -2200 (net: 22800)
    // D (子・立直): -1000 - 2000 - 200 = -3200 (net: 21800)
    const scoresAfter = {
      PlayerA: 34600,
      PlayerB: 20800,
      PlayerC: 22800,
      PlayerD: 21800,
    };

    const round: RoundRecord = {
      round_index: 1,
      kyoku_name: '東2局',
      honba: 2,
      win_type: 'tsumo',
      winner: 'PlayerA',
      loser: null,
      score: 8000,
      riichi: ['PlayerA', 'PlayerD'],
    };

    const details = computeRoundSeatDetails({
      players,
      round,
      startRiichiSticks,
      startHonba,
      scoresBefore,
      scoresAfter,
      ruleConfig,
    });

    for (const d of details) {
      const sum = d.basePoint + d.honbaPoint + d.kyotakuPoint + d.penaltyPoint;
      expect(sum).toBe(d.scoreDelta);
    }

    const a = details.find((d) => d.player === 'PlayerA')!;
    expect(a.basePoint).toBe(8000);
    expect(a.honbaPoint).toBe(600);
    expect(a.kyotakuPoint).toBe(1000); // 2000回収 - 自身1000 = 1000
    expect(a.scoreDelta).toBe(9600);

    const b = details.find((d) => d.player === 'PlayerB')!;
    expect(b.basePoint).toBe(-4000);
    expect(b.honbaPoint).toBe(-200);
    expect(b.kyotakuPoint).toBe(0);
    expect(b.scoreDelta).toBe(-4200);

    const d = details.find((d) => d.player === 'PlayerD')!;
    expect(d.basePoint).toBe(-2000);
    expect(d.honbaPoint).toBe(-200);
    expect(d.kyotakuPoint).toBe(-1000);
    expect(d.scoreDelta).toBe(-3200);
  });

  it('流局: 2名テンパイ (各+1500), 2名ノーテン (各-1500), AとCが立直', () => {
    const startRiichiSticks = 1;
    const startHonba = 0;
    const scoresBefore = {
      PlayerA: 25000,
      PlayerB: 25000,
      PlayerC: 25000,
      PlayerD: 25000,
    };

    // A: テンパイ(+1500), 立直(-1000) => delta: +500
    // B: テンパイ(+1500), 非立直(0) => delta: +1500
    // C: ノーテン(-1500), 立直(-1000) => delta: -2500
    // D: ノーテン(-1500), 非立直(0) => delta: -1500
    const scoresAfter = {
      PlayerA: 25500,
      PlayerB: 26500,
      PlayerC: 22500,
      PlayerD: 23500,
    };

    const round: RoundRecord = {
      round_index: 0,
      kyoku_name: '東1局',
      honba: 0,
      win_type: 'ryukyoku',
      winner: null,
      loser: null,
      score: 0,
      tenpai: ['PlayerA', 'PlayerB'],
      riichi: ['PlayerA', 'PlayerC'],
    };

    const details = computeRoundSeatDetails({
      players,
      round,
      startRiichiSticks,
      startHonba,
      scoresBefore,
      scoresAfter,
      ruleConfig,
    });

    for (const d of details) {
      const sum = d.basePoint + d.honbaPoint + d.kyotakuPoint + d.penaltyPoint;
      expect(sum).toBe(d.scoreDelta);
    }

    const a = details.find((d) => d.player === 'PlayerA')!;
    expect(a.basePoint).toBe(0); // 手役素点は0
    expect(a.penaltyPoint).toBe(1500); // テンパイ料
    expect(a.kyotakuPoint).toBe(-1000); // 立直供託
    expect(a.scoreDelta).toBe(500);

    const b = details.find((d) => d.player === 'PlayerB')!;
    expect(b.basePoint).toBe(0);
    expect(b.penaltyPoint).toBe(1500);
    expect(b.kyotakuPoint).toBe(0);
    expect(b.scoreDelta).toBe(1500);

    const c = details.find((d) => d.player === 'PlayerC')!;
    expect(c.basePoint).toBe(0);
    expect(c.penaltyPoint).toBe(-1500);
    expect(c.kyotakuPoint).toBe(-1000);
    expect(c.scoreDelta).toBe(-2500);

    const d = details.find((d) => d.player === 'PlayerD')!;
    expect(d.basePoint).toBe(0);
    expect(d.penaltyPoint).toBe(-1500);
    expect(d.kyotakuPoint).toBe(0);
    expect(d.scoreDelta).toBe(-1500);
  });

  it('computeAllRoundsDetails を通じた複数局の総合恒等式テスト', () => {
    const history: RoundRecord[] = [
      {
        round_index: 0,
        kyoku_name: '東1局',
        honba: 0,
        win_type: 'ryukyoku',
        winner: null,
        loser: null,
        score: 0,
        tenpai: ['PlayerA'],
        riichi: ['PlayerA'],
      },
      {
        round_index: 1,
        kyoku_name: '東1局',
        honba: 1,
        win_type: 'ron',
        winner: 'PlayerB',
        loser: 'PlayerC',
        score: 3900,
        riichi: ['PlayerB'],
        tenpai: ['PlayerB'],
      },
      {
        round_index: 2,
        kyoku_name: '東2局',
        honba: 0,
        win_type: 'tsumo',
        winner: 'PlayerC',
        loser: null,
        score: 8000,
        riichi: [],
        tenpai: ['PlayerC'],
      },
    ];

    const allDetails = computeAllRoundsDetails(players, 25000, ruleConfig, history);
    expect(allDetails.length).toBe(3);

    for (const r of allDetails) {
      for (const s of r.seatDetails) {
        const sum = s.basePoint + s.honbaPoint + s.kyotakuPoint + s.penaltyPoint;
        expect(sum).toBe(s.scoreDelta);
      }
    }
  });
});
