import { describe, expect, it } from 'vitest';
import {
  checkGameEnd,
  recalculateState,
  calculateGameSettlement,
} from '../src/lib/mahjong/rules';
import { RoundRecord, RuleConfig } from '../src/types/mahjong';

describe('rules: recalculateState (局進行・スコア再計算)', () => {
  const defaultRule: RuleConfig = {
    basic: { init_score: 25000, return_score: 30000 },
    detail: {
      noten_bappu_pt: 3000,
      mangan_base_pt: 8000,
      chombo_rule: 'mangan_pay',
      renchan_rule: 'tenpai',
      honba_pt: 300,
      riichi_pt: 1000,
    },
  };
  const players = ['P1', 'P2', 'P3', 'P4'];

  it('流局時のノーテン罰符配分（2名テンパイ、2名ノーテン: 各1500点移動）', () => {
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'ryukyoku',
        score: 0,
        riichi: [],
        tenpai: ['P1', 'P2'],
      },
    ];
    const state = recalculateState(players, 25000, defaultRule, roundHistory);
    expect(state.scores['P1']).toBe(26500);
    expect(state.scores['P3']).toBe(23500);
    // 親（P1）がテンパイしているため連荘（東1局1本場）
    expect(state.roundIdx).toBe(0);
    expect(state.honba).toBe(1);
  });

  it('流局時のカスタム罰符配分（罰符4000点、1名テンパイ）', () => {
    const customRule: RuleConfig = {
      ...defaultRule,
      detail: { ...defaultRule.detail, noten_bappu_pt: 4000 },
    };
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'ryukyoku',
        score: 0,
        riichi: [],
        tenpai: ['P1'],
      },
    ];
    const state = recalculateState(players, 25000, customRule, roundHistory);
    expect(state.scores['P1']).toBe(29000);
    expect(state.scores['P2']).toBe(23667); // 4000 // 3 = 1333支払い
  });

  it('チョンボ時の満貫払い（子が親に4000点、子に2000点）', () => {
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: 'P2', // チョンボ者
        loser: null,
        win_type: 'chombo',
        score: 0,
        riichi: [],
      },
    ];
    const state = recalculateState(players, 25000, defaultRule, roundHistory);
    expect(state.scores['P2']).toBe(17000); // 25000 - 4000 - 2000 - 2000
    expect(state.scores['P1']).toBe(29000); // 親: +4000
    expect(state.scores['P3']).toBe(27000); // 子: +2000
    // チョンボは局・本場が据え置き
    expect(state.roundIdx).toBe(0);
    expect(state.honba).toBe(0);
  });

  it('チョンボ時のカスタム満貫点（親が12000点満貫払いで子3名に各6000点）', () => {
    const customRule: RuleConfig = {
      ...defaultRule,
      detail: { ...defaultRule.detail, mangan_base_pt: 12000 },
    };
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: 'P1', // 親のチョンボ
        loser: null,
        win_type: 'chombo',
        score: 0,
        riichi: [],
      },
    ];
    const state = recalculateState(players, 25000, customRule, roundHistory);
    expect(state.scores['P1']).toBe(7000); // 25000 - 6000 * 3
    expect(state.scores['P2']).toBe(31000);
  });

  it('ダブロン時の供託上家取りと親連荘', () => {
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'ryukyoku',
        score: 0,
        riichi: ['P1'], // P1リーチで流局（供託1本持ち越し）
        tenpai: ['P1', 'P2', 'P3', 'P4'],
      },
      {
        kyoku_name: '東1局',
        winner: 'P1', // 上家取り
        loser: 'P3',
        win_type: 'multi_ron',
        score: 0,
        riichi: [],
        multi_wins: [
          { winner: 'P1', points_data: { total: 5800 } },
          { winner: 'P2', points_data: { total: 3900 } },
        ],
      },
    ];
    const state = recalculateState(players, 25000, defaultRule, roundHistory);
    // 放銃者P3: 25000 - (5800 + 300) - (3900 + 300) = 14700
    expect(state.scores['P3']).toBe(25000 - 5800 - 300 - 3900 - 300);
    // P1 (親): 25000 - 1000(前局リーチ) + 5800 + 300 + 1000(供託回収) = 31100
    expect(state.scores['P1']).toBe(25000 - 1000 + 5800 + 300 + 1000);
    // P2: 25000 + 3900 + 300 = 29200
    expect(state.scores['P2']).toBe(25000 + 3900 + 300);
    // 親P1が和了したので連荘（東1局2本場）
    expect(state.roundIdx).toBe(0);
    expect(state.honba).toBe(2);
  });

  it('途中流局の判定（九種九牌: renchan vs ryukyoku）', () => {
    // 1. renchan 設定（連荘）
    const renchanRule: RuleConfig = {
      ...defaultRule,
      detail: { ...defaultRule.detail, kyushu: 'renchan' },
    };
    const historyRenchan: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'mid_ryukyoku',
        ryukyoku_type: 'kyushu',
        score: 0,
        riichi: [],
      },
    ];
    const s1 = recalculateState(players, 25000, renchanRule, historyRenchan);
    expect(s1.honba).toBe(1);
    expect(s1.roundIdx).toBe(0);

    // 2. ryukyoku 設定（親流れ）
    const ryukyokuRule: RuleConfig = {
      ...defaultRule,
      detail: { ...defaultRule.detail, kyushu: 'ryukyoku' },
    };
    const s2 = recalculateState(players, 25000, ryukyokuRule, historyRenchan);
    expect(s2.honba).toBe(1);
    expect(s2.roundIdx).toBe(1);
  });

  it('連荘ルール切替（テンパイ連荘 vs アガリ連荘）', () => {
    const ryukyokuHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'ryukyoku',
        score: 0,
        riichi: [],
        tenpai: ['P1', 'P2'], // 親P1テンパイ
      },
    ];

    // テンパイ連荘
    const sTenpai = recalculateState(players, 25000, defaultRule, ryukyokuHistory);
    expect(sTenpai.roundIdx).toBe(0);
    expect(sTenpai.honba).toBe(1);

    // アガリ連荘（テンパイでも親流れ）
    const agariRule: RuleConfig = {
      ...defaultRule,
      detail: { ...defaultRule.detail, renchan_rule: 'agari' },
    };
    const sAgari = recalculateState(players, 25000, agariRule, ryukyokuHistory);
    expect(sAgari.roundIdx).toBe(1);
    expect(sAgari.honba).toBe(1);
  });

  it('総点10万点保存則（不変量テスト: リーチ・流局・和了・チョンボ・進行中リーチ）', () => {
    const check100k = (history: RoundRecord[], currentRiichi: string[] = []) => {
      const state = recalculateState(players, 25000, defaultRule, history, currentRiichi);
      const total =
        Object.values(state.scores).reduce((sum, s) => sum + s, 0) +
        state.riichiStick * 1000;
      expect(total).toBe(100000);
    };

    const history: RoundRecord[] = [];

    // 初期状態
    check100k(history);

    // 1. P1リーチ宣言中
    check100k(history, ['P1']);

    // 2. 流局（P1, P2テンパイ）
    history.push({
      kyoku_name: '東1局',
      winner: null,
      loser: null,
      win_type: 'ryukyoku',
      score: 0,
      riichi: ['P1'],
      tenpai: ['P1', 'P2'],
    });
    check100k(history);

    // 3. 東1局1本場: P2リーチ宣言中
    check100k(history, ['P2']);

    // 4. P3放銃、P1ロン和了（3900点 + 供託回収）
    history.push({
      kyoku_name: '東1局',
      winner: 'P1',
      loser: 'P3',
      win_type: 'ron',
      score: 3900,
      riichi: ['P2'],
    });
    check100k(history);

    // 5. 東1局2本場: P4ツモ和了 (6000点)
    history.push({
      kyoku_name: '東1局',
      winner: 'P4',
      loser: null,
      win_type: 'tsumo',
      score: 6000,
      riichi: [],
    });
    check100k(history);

    // 6. P3チョンボ (満貫払い)
    history.push({
      kyoku_name: '東2局',
      winner: 'P3',
      loser: null,
      win_type: 'chombo',
      score: 0,
      riichi: [],
    });
    check100k(history);
  });
});

describe('rules: checkGameEnd (対局終了・トビ・サドンデス判定)', () => {
  const players = ['P1', 'P2', 'P3', 'P4'];
  const baseRule: RuleConfig = {
    basic: { init_score: 25000, return_score: 30000, game_length: 'hanchan' },
    detail: {
      tobi_end: 'under_zero',
      west_extension: 'under_30000',
      agari_yame: true,
      tenpai_yame: true,
    },
  };

  it('トビ判定: under_zero（0点ちょうどは続行、-100点は終了）', () => {
    // 0点ちょうど: 続行
    const scoresZero = { P1: 30000, P2: 35000, P3: 35000, P4: 0 };
    expect(checkGameEnd(scoresZero, 0, players, baseRule)).toBeNull();

    // -100点: 飛び終了
    const scoresMinus = { P1: 30000, P2: 35000, P3: 35100, P4: -100 };
    const res = checkGameEnd(scoresMinus, 0, players, baseRule);
    expect(res).not.toBeNull();
    expect(res).toContain('飛び終了');
  });

  it('トビ判定: zero_or_less（0点以下で即終了）', () => {
    const zeroRule: RuleConfig = {
      ...baseRule,
      detail: { ...baseRule.detail, tobi_end: 'zero_or_less' },
    };
    const scoresZero = { P1: 30000, P2: 35000, P3: 35000, P4: 0 };
    const res = checkGameEnd(scoresZero, 0, players, zeroRule);
    expect(res).not.toBeNull();
    expect(res).toContain('飛び終了');
  });

  it('アガリやめ判定: 南4局親トップで和了時', () => {
    const scores = { P1: 25000, P2: 25000, P3: 19000, P4: 31000 };
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '南4局',
        winner: 'P4', // 親
        loser: 'P3',
        win_type: 'ron',
        score: 1000,
        riichi: [],
      },
    ];
    // 南4局（roundIdx: 7）
    const res = checkGameEnd(scores, 7, players, baseRule, roundHistory);
    expect(res).not.toBeNull();
    expect(res).toContain('アガリやめ');
  });

  it('西入サドンデス判定（南4局終了時トップ30000点未満なら西入、西1局で30000点到達なら終了）', () => {
    // 南4局終了時（roundIdx: 7）、トップが29000点 -> 続行（西入）
    const scoresSub30k = { P1: 29000, P2: 28000, P3: 23000, P4: 20000 };
    const resWest = checkGameEnd(scoresSub30k, 7, players, baseRule);
    expect(resWest).toBeNull();

    // 西1局（roundIdx: 8）でトップが32000点に到達 -> サドンデス終了
    const scores32k = { P1: 20000, P2: 32000, P3: 26000, P4: 22000 };
    const historyWithWest: RoundRecord[] = [
      {
        kyoku_name: '西1局',
        winner: 'P2', // 子（親はP1）がアガってトップ終了
        loser: 'P1',
        win_type: 'ron',
        score: 3000,
        riichi: [],
      },
    ];
    const resEnd = checkGameEnd(scores32k, 8, players, baseRule, historyWithWest);
    expect(resEnd).not.toBeNull();
    expect(resEnd).toContain('サドンデス終了');
  });
});

describe('rules: calculateGameSettlement (終局時精算・順位・ウマオカ・ゼロサム検算)', () => {
  const defaultRule: RuleConfig = {
    basic: { init_score: 25000, return_score: 30000, uma: [50, 10, -10, -30] },
    detail: { riichi_pt: 1000 },
  };
  const players = ['P1', 'P2', 'P3', 'P4'];

  it('通常精算: 供託なし、点差明確な場合', () => {
    const scores = { P1: 38000, P2: 27000, P3: 21000, P4: 14000 };
    const results = calculateGameSettlement(players, scores, defaultRule, 0);

    expect(results).toHaveLength(4);
    // 1位: P1 (38000点 -> (38-30)+50 = +58.0pt)
    expect(results[0].player).toBe('P1');
    expect(results[0].rank).toBe(1);
    expect(results[0].finalScore).toBe(38000);
    expect(results[0].point).toBe(58.0);

    // 2位: P2 (27000点 -> (27-30)+10 = +7.0pt)
    expect(results[1].player).toBe('P2');
    expect(results[1].rank).toBe(2);
    expect(results[1].finalScore).toBe(27000);
    expect(results[1].point).toBe(7.0);

    // 3位: P3 (21000点 -> (21-30)-10 = -19.0pt)
    expect(results[2].player).toBe('P3');
    expect(results[2].rank).toBe(3);
    expect(results[2].finalScore).toBe(21000);
    expect(results[2].point).toBe(-19.0);

    // 4位: P4 (14000点 -> (14-30)-30 = -46.0pt)
    expect(results[3].player).toBe('P4');
    expect(results[3].rank).toBe(4);
    expect(results[3].finalScore).toBe(14000);
    expect(results[3].point).toBe(-46.0);

    // 合計が完全に 0.0pt になっていること
    const sumPt = results.reduce((acc, r) => acc + r.point, 0);
    expect(Math.round(sumPt * 10) / 10).toBe(0.0);
  });

  it('供託リーチ棒のトップ加算: 供託2本（2000点）が1位に加算されること', () => {
    const scores = { P1: 36000, P2: 27000, P3: 21000, P4: 14000 };
    const results = calculateGameSettlement(players, scores, defaultRule, 2);

    expect(results[0].player).toBe('P1');
    expect(results[0].rawScore).toBe(36000);
    expect(results[0].finalScore).toBe(38000); // 36000 + 2000
    expect(results[0].point).toBe(58.0);
  });

  it('同点時の起家優先ルール: P1(東家)とP2(南家)が同点ならP1が上位', () => {
    const scores = { P1: 25000, P2: 25000, P3: 25000, P4: 25000 };
    const results = calculateGameSettlement(players, scores, defaultRule, 0);

    expect(results[0].player).toBe('P1');
    expect(results[0].rank).toBe(1);
    expect(results[1].player).toBe('P2');
    expect(results[1].rank).toBe(2);
    expect(results[2].player).toBe('P3');
    expect(results[2].rank).toBe(3);
    expect(results[3].player).toBe('P4');
    expect(results[3].rank).toBe(4);

    const sumPt = results.reduce((acc, r) => acc + r.point, 0);
    expect(Math.round(sumPt * 10) / 10).toBe(0.0);
  });
});
