import { describe, it, expect } from 'vitest';
import { YAKUMAN_CANDIDATES } from '@/types/mahjong';
import { calculateScore } from '@/lib/mahjong/calc';

describe('Yakuman candidates and score calculation', () => {
  it('should have correct candidate definitions', () => {
    expect(YAKUMAN_CANDIDATES.length).toBeGreaterThan(10);
    const kokushi = YAKUMAN_CANDIDATES.find((c) => c.name === '国士無双');
    expect(kokushi).toBeDefined();
    expect(kokushi?.mult).toBe(1);

    const suankoTanki = YAKUMAN_CANDIDATES.find((c) => c.name === '四暗刻単騎');
    expect(suankoTanki).toBeDefined();
    expect(suankoTanki?.mult).toBe(2);

    const daisushi = YAKUMAN_CANDIDATES.find((c) => c.name === '大四喜');
    expect(daisushi).toBeDefined();
    expect(daisushi?.mult).toBe(2);
  });

  it('calculates single yakuman score correctly', () => {
    // 子ロン 13翻 30符 -> 32,000点
    const koRon = calculateScore(13, 30, false, false);
    expect(koRon.total).toBe(32000);

    // 親ロン 13翻 30符 -> 48,000点
    const oyaRon = calculateScore(13, 30, true, false);
    expect(oyaRon.total).toBe(48000);

    // 子ツモ 13翻 30符 -> 8,000 / 16,000 (合計32,000)
    const koTsumo = calculateScore(13, 30, false, true);
    expect(koTsumo.total).toBe(32000);
    expect(koTsumo.nonDealerPay).toBe(8000);
    expect(koTsumo.dealerPay).toBe(16000);

    // 親ツモ 13翻 30符 -> 16,000オール (合計48,000)
    const oyaTsumo = calculateScore(13, 30, true, true);
    expect(oyaTsumo.total).toBe(48000);
    expect(oyaTsumo.nonDealerPay).toBe(16000);
  });

  it('calculates double yakuman score correctly', () => {
    // 子ロン 26翻 30符 -> 64,000点
    const koRon = calculateScore(26, 30, false, false);
    expect(koRon.total).toBe(64000);

    // 親ロン 26翻 30符 -> 96,000点
    const oyaRon = calculateScore(26, 30, true, false);
    expect(oyaRon.total).toBe(96000);

    // 子ツモ 26翻 30符 -> 16,000 / 32,000 (合計64,000)
    const koTsumo = calculateScore(26, 30, false, true);
    expect(koTsumo.total).toBe(64000);
    expect(koTsumo.nonDealerPay).toBe(16000);
    expect(koTsumo.dealerPay).toBe(32000);

    // 親ツモ 26翻 30符 -> 32,000オール (合計96,000)
    const oyaTsumo = calculateScore(26, 30, true, true);
    expect(oyaTsumo.total).toBe(96000);
    expect(oyaTsumo.nonDealerPay).toBe(32000);
  });
});
