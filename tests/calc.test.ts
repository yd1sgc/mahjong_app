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
