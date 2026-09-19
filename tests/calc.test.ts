import { describe, expect, it } from 'vitest';
import {
  calcOkaNashiPoint,
  calcPoint,
  calculateScore,
} from '../src/lib/mahjong/calc';

describe('calculateScore (翻数・符数からの和了点数計算)', () => {
  it('1翻30符 親ロン: 1500点', () => {
    const res = calculateScore(1, 30, true, false);
    expect(res.total).toBe(1500);
    expect(res.dealerPay).toBe(0);
    expect(res.nonDealerPay).toBe(0);
  });

  it('1翻30符 子ロン: 1000点', () => {
    const res = calculateScore(1, 30, false, false);
    expect(res.total).toBe(1000);
    expect(res.dealerPay).toBe(0);
    expect(res.nonDealerPay).toBe(0);
  });

  it('3翻30符 親ツモ: 2000点オール（計6000点）', () => {
    const res = calculateScore(3, 30, true, true);
    expect(res.total).toBe(6000);
    expect(res.dealerPay).toBe(0);
    expect(res.nonDealerPay).toBe(2000);
  });

  it('3翻30符 子ツモ: 1000・2000点（計4000点）', () => {
    const res = calculateScore(3, 30, false, true);
    expect(res.total).toBe(4000);
    expect(res.dealerPay).toBe(2000);
    expect(res.nonDealerPay).toBe(1000);
  });

  it('満貫 親ロン: 12000点', () => {
    const res = calculateScore(5, 30, true, false);
    expect(res.total).toBe(12000);
  });

  it('満貫 子ロン: 8000点', () => {
    const res = calculateScore(5, 30, false, false);
    expect(res.total).toBe(8000);
  });

  it('2翻40符 子ツモ: 700・1300点（計2700点）', () => {
    const res = calculateScore(2, 40, false, true);
    expect(res.total).toBe(2700);
    expect(res.dealerPay).toBe(1300);
    expect(res.nonDealerPay).toBe(700);
  });

  it('1翻40符 子ツモ: 400・700点（計1500点）', () => {
    const res = calculateScore(1, 40, false, true);
    expect(res.total).toBe(1500);
    expect(res.dealerPay).toBe(700);
    expect(res.nonDealerPay).toBe(400);
  });

  it('2翻40符 親ツモ: 1300点オール（計3900点）', () => {
    const res = calculateScore(2, 40, true, true);
    expect(res.total).toBe(3900);
    expect(res.dealerPay).toBe(0);
    expect(res.nonDealerPay).toBe(1300);
  });

  it('七対子 2翻25符 子ツモ: 400・800点（計1600点）', () => {
    const res = calculateScore(2, 25, false, true);
    expect(res.total).toBe(1600);
    expect(res.dealerPay).toBe(800);
    expect(res.nonDealerPay).toBe(400);
  });

  it('七対子 2翻25符 親ツモ: 800点オール（計2400点）', () => {
    const res = calculateScore(2, 25, true, true);
    expect(res.total).toBe(2400);
    expect(res.dealerPay).toBe(0);
    expect(res.nonDealerPay).toBe(800);
  });

  it('七対子 2翻25符 子ロン: 1600点', () => {
    const res = calculateScore(2, 25, false, false);
    expect(res.total).toBe(1600);
  });

  it('七対子 2翻25符 親ロン: 2400点', () => {
    const res = calculateScore(2, 25, true, false);
    expect(res.total).toBe(2400);
  });

  it('1翻50符 子ロン: 1600点', () => {
    const res = calculateScore(1, 50, false, false);
    expect(res.total).toBe(1600);
  });

  it('1翻50符 親ロン: 2400点', () => {
    const res = calculateScore(1, 50, true, false);
    expect(res.total).toBe(2400);
  });

  it('4翻30符 切り上げなし: 子7700点 / 親11600点', () => {
    const ko = calculateScore(4, 30, false, false);
    expect(ko.total).toBe(7700);
    const oya = calculateScore(4, 30, true, false);
    expect(oya.total).toBe(11600);
  });

  it('3翻60符 切り上げなし: 子7700点 / 親11600点', () => {
    const ko = calculateScore(3, 60, false, false);
    expect(ko.total).toBe(7700);
    const oya = calculateScore(3, 60, true, false);
    expect(oya.total).toBe(11600);
  });

  it('4翻40符 満貫到達: 子8000点 / 親12000点', () => {
    const ko = calculateScore(4, 40, false, false);
    expect(ko.total).toBe(8000);
    const oya = calculateScore(4, 40, true, false);
    expect(oya.total).toBe(12000);
  });

  it('跳満 親ロン: 18000点', () => {
    const res = calculateScore(6, 30, true, false);
    expect(res.total).toBe(18000);
  });

  it('倍満 親ロン: 24000点', () => {
    const res = calculateScore(8, 30, true, false);
    expect(res.total).toBe(24000);
  });

  it('役満 親ロン: 48000点', () => {
    const res = calculateScore(13, 30, true, false);
    expect(res.total).toBe(48000);
  });
});

describe('calcPoint (ウマ・オカを含む最終ポイント計算)', () => {
  it('1位 30000点ちょうど: +50.0pt', () => {
    expect(calcPoint(30000, 1)).toBe(50.0);
  });

  it('4位 20000点: -40.0pt', () => {
    expect(calcPoint(20000, 4)).toBe(-40.0);
  });

  it('2位 35000点: +15.0pt', () => {
    expect(calcPoint(35000, 2)).toBe(15.0);
  });

  it('4名のポイント総和が厳密に0（ゼロサム不変量）', () => {
    const scores = [40000, 32000, 18000, 10000];
    const ranks = [1, 2, 3, 4];
    const total = ranks.reduce(
      (sum, r, idx) => sum + calcPoint(scores[idx], r),
      0
    );
    expect(Math.abs(total)).toBeLessThan(1e-6);
  });
});

describe('calcOkaNashiPoint (オカなし設定でのポイント計算)', () => {
  it('1位 25000点: +30.0pt', () => {
    expect(calcOkaNashiPoint(25000, 1)).toBe(30.0);
  });

  it('2位 25000点: +10.0pt', () => {
    expect(calcOkaNashiPoint(25000, 2)).toBe(10.0);
  });

  it('3位 30000点: -5.0pt', () => {
    expect(calcOkaNashiPoint(30000, 3)).toBe(-5.0);
  });

  it('オカなしでも4名のポイント総和が厳密に0（ゼロサム不変量）', () => {
    const scores = [40000, 32000, 18000, 10000];
    const ranks = [1, 2, 3, 4];
    const total = ranks.reduce(
      (sum, r, idx) => sum + calcOkaNashiPoint(scores[idx], r),
      0
    );
    expect(Math.abs(total)).toBeLessThan(1e-6);
  });
});

describe('Score Presets (点数プリセット定義の整合性)', () => {
  it('子ツモ・親ツモ・ロンの全プリセットで pointsLabel と hanFuLabel が欠損なく定義されている', async () => {
    const presets = await import('../src/lib/mahjong/presets');
    const allPresets = [
      ...presets.KO_RON_PRESETS_3X4,
      ...presets.OYA_RON_PRESETS_3X4,
      ...presets.KO_TSUMO_PRESETS_3X4,
      ...presets.OYA_TSUMO_PRESETS_3X4,
      ...presets.HIGH_SCORE_PRESETS.ko_ron,
      ...presets.HIGH_SCORE_PRESETS.oya_ron,
      ...presets.HIGH_SCORE_PRESETS.ko_tsumo,
      ...presets.HIGH_SCORE_PRESETS.oya_tsumo,
    ];

    for (const item of allPresets) {
      expect(item.pointsLabel).toBeTruthy();
      expect(item.hanFuLabel).toBeTruthy();
      // 単なるスラッシュや記号のみになっていないことを検証
      expect(item.pointsLabel.trim()).not.toBe('/');
      expect(item.hanFuLabel.trim()).not.toBe('/');
    }

    // 子ツモの代表値が期待通り分割されていることの検証
    const koTsumo1 = presets.KO_TSUMO_PRESETS_3X4[0];
    expect(koTsumo1.pointsLabel).toBe('300/500');
    expect(koTsumo1.hanFuLabel).toBe('1翻30符');

    // 親ツモの代表値が期待通り分割されていることの検証
    const oyaTsumo1 = presets.OYA_TSUMO_PRESETS_3X4[0];
    expect(oyaTsumo1.pointsLabel).toBe('500オール');
    expect(oyaTsumo1.hanFuLabel).toBe('1翻30符');
  });

  describe('高翻数および特殊計算のエッジケース検証', () => {
    it('11翻 三倍満: 子24000点 / 親36000点', () => {
      const koRon = calculateScore(11, 30, false, false);
      expect(koRon.total).toBe(24000);

      const oyaRon = calculateScore(11, 30, true, false);
      expect(oyaRon.total).toBe(36000);

      const koTsumo = calculateScore(12, 30, false, true);
      expect(koTsumo.total).toBe(24000);
      expect(koTsumo.dealerPay).toBe(12000);
      expect(koTsumo.nonDealerPay).toBe(6000);

      const oyaTsumo = calculateScore(12, 30, true, true);
      expect(oyaTsumo.total).toBe(36000);
      expect(oyaTsumo.nonDealerPay).toBe(12000);
    });

    it('26翻以上 数え役満 / 二倍役満: 子64000点 / 親96000点', () => {
      const koRon = calculateScore(26, 30, false, false);
      expect(koRon.total).toBe(64000);

      const oyaRon = calculateScore(26, 30, true, false);
      expect(oyaRon.total).toBe(96000);

      const koTsumo = calculateScore(26, 30, false, true);
      expect(koTsumo.total).toBe(64000);
      expect(koTsumo.dealerPay).toBe(32000);
      expect(koTsumo.nonDealerPay).toBe(16000);

      const oyaTsumo = calculateScore(26, 30, true, true);
      expect(oyaTsumo.total).toBe(96000);
      expect(oyaTsumo.nonDealerPay).toBe(32000);
    });

    it('calcPoint: pt_penalty ルール適用時、チョンボ回数に応じてポイントが正しく減点されること', () => {
      const ruleWithPtPenalty = {
        basic: { return_score: 30000, uma: [20, 10, -10, -20] },
        detail: {
          chombo_rule: 'pt_penalty',
          chombo_pt: 20, // チョンボ1回につき -20pt
        },
      };

      // 2位 30000点、チョンボ1回
      // 通常pt: (30000 - 30000)/1000 + 10 = 10.0
      // チョンボ減点: -20
      // 最終pt: -10.0
      const pt = calcPoint(30000, 2, ruleWithPtPenalty as any, 1);
      expect(pt).toBe(-10);

      // チョンボ2回
      const pt2 = calcPoint(30000, 2, ruleWithPtPenalty as any, 2);
      expect(pt2).toBe(-30);
    });
  });
});
