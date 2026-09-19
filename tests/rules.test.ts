import { describe, expect, it } from 'vitest';
import {
  checkGameEnd,
  computeAllRoundsDetails,
  recalculateState,
  calculateGameSettlement,
  getClosestWinner,
  canDeclareRiichi,
} from '../src/lib/mahjong/rules';
import { generateRuleDescription } from '../src/lib/mahjong/ruleDescription';
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

  it('上家取り判定: getClosestWinnerがツモ巡最寄りの和了者を正しく特定すること', () => {
    // players: ['P1', 'P2', 'P3', 'P4'] (東, 南, 西, 北)
    // 放銃者: P2 (南家)
    // 和了者: P1 (東家: 距離3), P3 (西家: 距離1), P4 (北家: 距離2)
    expect(getClosestWinner(players, 'P2', ['P1', 'P3'])).toBe('P3');
    expect(getClosestWinner(players, 'P2', ['P1', 'P4'])).toBe('P4');
    expect(getClosestWinner(players, 'P2', ['P1', 'P3', 'P4'])).toBe('P3');

    // 放銃者: P4 (北家)
    // 和了者: P1 (東家: 距離1), P2 (南家: 距離2) -> P1が最寄り
    expect(getClosestWinner(players, 'P4', ['P2', 'P1'])).toBe('P1');
  });

  it('トリプルロン時の各打点・本場・供託上家取りの整合性', () => {
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東2局',
        winner: 'P1', // 上家取り
        loser: 'P4', // 北家放銃
        win_type: 'multi_ron',
        score: 0,
        riichi: [],
        multi_wins: [
          { winner: 'P1', points_data: { total: 2000 } }, // 東家（距離1）
          { winner: 'P2', points_data: { total: 3900 } }, // 南家（距離2）
          { winner: 'P3', points_data: { total: 8000 } }, // 西家（距離3）
        ],
      },
    ];
    // 供託1本（1000点）持ち越し状態とするために前局リーチ流局を入れる
    const historyWithRiichi: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'ryukyoku',
        score: 0,
        riichi: ['P4'],
        tenpai: [],
      },
      ...roundHistory,
    ];

    const state = recalculateState(players, 25000, defaultRule, historyWithRiichi);

    // 放銃者P4: 25000 - 1000(前局リーチ) - (2000+300) - (3900+300) - (8000+300) = 9200
    expect(state.scores['P4']).toBe(25000 - 1000 - (2000 + 300) - (3900 + 300) - (8000 + 300));
    // P1 (上家取り): 25000 + 2000 + 300 + 1000(供託回収) = 28300
    expect(state.scores['P1']).toBe(25000 + 2000 + 300 + 1000);
    // P2 (東2局の親): 25000 + 3900 + 300 = 29200
    expect(state.scores['P2']).toBe(25000 + 3900 + 300);
    // P3: 25000 + 8000 + 300 = 33300
    expect(state.scores['P3']).toBe(25000 + 8000 + 300);
    // 東2局の親P2が和了したため連荘（東2局2本場）
    expect(state.roundIdx).toBe(1);
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

  it('四人リーチ（四家立直）での途中流局と供託・スコア変動の整合性', () => {
    const historyFourRiichi: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'mid_ryukyoku',
        ryukyoku_type: 'four_riichi',
        score: 0,
        riichi: [...players], // 4名全員立直
      },
    ];
    const s = recalculateState(players, 25000, defaultRule, historyFourRiichi);
    // デフォルトでは連荘（東1局1本場）
    expect(s.roundIdx).toBe(0);
    expect(s.honba).toBe(1);
    // 供託棒が4本蓄積
    expect(s.riichiStick).toBe(4);
    // 全員リーチ棒1000点拠出で24000点
    expect(s.scores['P1']).toBe(24000);
    expect(s.scores['P2']).toBe(24000);
    expect(s.scores['P3']).toBe(24000);
    expect(s.scores['P4']).toBe(24000);
  });

  it('荒廃流局時に立直者が親の場合、テンパイ連荘ルールで連荘となること', () => {
    const history: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: null,
        loser: null,
        win_type: 'ryukyoku',
        score: 0,
        riichi: ['P1'], // 親P1が立直
        tenpai: ['P1'], // 立直者P1は必ず聴牌
      },
    ];
    const s = recalculateState(players, 25000, defaultRule, history);
    // 親P1がテンパイしているため連荘（東1局1本場）
    expect(s.roundIdx).toBe(0);
    expect(s.honba).toBe(1);
    expect(s.riichiStick).toBe(1);
    // P1はリーチ棒-1000 + 1人テンパイ料+3000 = +2000 (27000)
    expect(s.scores['P1']).toBe(27000);
    // 子P2,P3,P4はノーテン罰符各-1000 = 24000
    expect(s.scores['P2']).toBe(24000);
    expect(s.scores['P3']).toBe(24000);
    expect(s.scores['P4']).toBe(24000);
  });

  it('進行中の立直宣言（currentRiichiDeclared）がスコアと供託棒に正しく反映されること', () => {
    // 局履歴なし（東1局開始時）で P1 と P3 が立直を宣言
    const state = recalculateState(players, 25000, defaultRule, [], ['P1', 'P3']);
    expect(state.scores['P1']).toBe(24000);
    expect(state.scores['P2']).toBe(25000);
    expect(state.scores['P3']).toBe(24000);
    expect(state.scores['P4']).toBe(25000);
    expect(state.riichiStick).toBe(2);
    expect(state.riichiDeclared).toEqual(['P1', 'P3']);
  });

  it('進行中の局で立直宣言後、和了者が供託棒を総取りすること（二重加算なし）', () => {
    // 東1局で P1 が立直をかけ、P2 が 1000点（子ロン）で P3 から和了
    const roundHistory: RoundRecord[] = [
      {
        kyoku_name: '東1局',
        winner: 'P2',
        loser: 'P3',
        win_type: 'ron',
        score: 1000,
        riichi: ['P1'],
      },
    ];
    const state = recalculateState(players, 25000, defaultRule, roundHistory, []);
    // P1: 立直棒-1000 = 24000
    // P3: 放銃-1000 = 24000
    // P2: アガリ+1000 + 供託1本(+1000) = 27000
    // P4: 変動なし = 25000
    expect(state.scores['P1']).toBe(24000);
    expect(state.scores['P2']).toBe(27000);
    expect(state.scores['P3']).toBe(24000);
    expect(state.scores['P4']).toBe(25000);
    expect(state.riichiStick).toBe(0); // 供託棒回収済み
  });

  it('親の連荘判定（テンパイ連荘: 親テンパイ時連荘）', () => {
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

describe('rules: generateRuleDescription (詳細ルール説明マップ生成)', () => {
  it('デフォルト/空設定から体系的なカテゴリ別説明が生成されること', () => {
    const desc = generateRuleDescription({});
    expect(desc['精算']).toBeDefined();
    expect(desc['基本・アリアリルール']).toBeDefined();
    expect(desc['試合の進行・点数']).toBeDefined();
    expect(desc['特殊ルール・チョンボ']).toBeDefined();

    expect(desc['精算'].some((s) => s.includes('25,000点持ち / 30,000点返し'))).toBe(true);
    expect(desc['基本・アリアリルール'].some((s) => s.includes('喰いタン：あり'))).toBe(true);
    expect(desc['試合の進行・点数'].some((s) => s.includes('親連荘条件：聴牌連荘'))).toBe(true);
    expect(desc['特殊ルール・チョンボ'].some((s) => s.includes('チョンボ扱い：満貫払い'))).toBe(true);
  });

  it('カスタム設定（トビなし、和了連荘、ハウスメモ、赤ドラ、本場点等）が正しく反映されること', () => {
    const customConfig: RuleConfig = {
      basic: {
        game_length: 'tonpu',
        init_score: 30000,
        return_score: 30000,
        uma: [30, 10, -10, -30],
        rate_note: '1000点＝50円',
      },
      detail: {
        tobi_end: 'none',
        renchan_rule: 'agari',
        kuitan: false,
        aka_dora: '4枚 (赤5筒2枚)',
        kiriage_mangan: true,
        honba_pt: 1500,
        noten_bappu_pt: 4000,
        wareme: true,
        house_notes: '役満祝儀あり\n鳴き麻雀禁止',
      },
    };

    const desc = generateRuleDescription(customConfig);
    expect(desc['精算'].some((s) => s.includes('形式：東風戦'))).toBe(true);
    expect(desc['精算'].some((s) => s.includes('30,000点持ち / 30,000点返し / トビなし'))).toBe(true);
    expect(desc['精算'].some((s) => s.includes('レート・換算メモ：1000点＝50円'))).toBe(true);
    expect(desc['基本・アリアリルール'].some((s) => s.includes('喰いタン：なし'))).toBe(true);
    expect(desc['基本・アリアリルール'].some((s) => s.includes('赤牌：4枚 (赤5筒2枚)'))).toBe(true);
    expect(desc['基本・アリアリルール'].some((s) => s.includes('切り上げ満貫あり'))).toBe(true);
    expect(desc['試合の進行・点数'].some((s) => s.includes('親連荘条件：和了連荘'))).toBe(true);
    expect(desc['試合の進行・点数'].some((s) => s.includes('本場：1,500点 / リーチ棒：1,000点 / ノーテン罰符：場4,000点'))).toBe(true);
    expect(desc['特殊ルール・チョンボ'].some((s) => s.includes('割れ目：あり (得失点2倍)'))).toBe(true);
    expect(desc['ハウスルール補足メモ']).toBeDefined();
    expect(desc['ハウスルール補足メモ']).toContain('役満祝儀あり');
    expect(desc['ハウスルール補足メモ']).toContain('鳴き麻雀禁止');
  });
});

describe('rules: computeAllRoundsDetails & 局修正連鎖再計算', () => {
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

  it('computeAllRoundsDetails: 各局の局名・本場・供託・座席差分が正確に算出されること', () => {
    const roundHistory: RoundRecord[] = [
      {
        round_id: 'r1',
        kyoku_name: '東1局',
        win_type: 'ron',
        winner: 'P1',
        loser: 'P2',
        score: 8000,
        riichi: ['P3'],
        tenpai: [],
      },
      {
        round_id: 'r2',
        kyoku_name: '東1局',
        win_type: 'tsumo',
        winner: 'P2',
        loser: null,
        score: 4000, // 子ツモ: 親2000, 子1000
        riichi: [],
        tenpai: [],
      },
    ];

    const details = computeAllRoundsDetails(players, 25000, defaultRule, roundHistory);
    expect(details.length).toBe(2);

    // 第1局 (東1局 0本場)
    const r1 = details[0];
    expect(r1.kyokuName).toBe('東1局');
    expect(r1.honba).toBe(0);
    expect(r1.riichiSticks).toBe(0);
    // P3がリーチ (-1000)、P2がP1へ放銃 (-8000)、P1が和了 (+8000 + 供託1000 = +9000)
    expect(r1.scoresAfter['P1']).toBe(34000);
    expect(r1.scoresAfter['P2']).toBe(17000);
    expect(r1.scoresAfter['P3']).toBe(24000);
    expect(r1.scoresAfter['P4']).toBe(25000);

    // 第2局 (P1和了により親連荘: 東1局 1本場)
    const r2 = details[1];
    expect(r2.kyokuName).toBe('東1局');
    expect(r2.honba).toBe(1);
    expect(r2.riichiSticks).toBe(0);
    // P2が子ツモ 1000/2000 + 1本場(100オール)
    // 親P1支払い: 2100, 子P3, P4支払い: 1100, P2受取: 4300
    expect(r2.scoresAfter['P2']).toBe(17000 + 4300);
    expect(r2.scoresAfter['P1']).toBe(34000 - 2100);
  });

  it('局修正の連鎖再計算: 第1局を親アガリから子アガリに変更すると親番が輪荘し第2局の局名が東2局にシフトすること', () => {
    // 修正前の履歴（第1局: P1ロン和了 → 第2局: 東1局1本場）
    const roundHistory: RoundRecord[] = [
      {
        round_id: 'r1',
        kyoku_name: '東1局',
        win_type: 'ron',
        winner: 'P1',
        loser: 'P2',
        score: 8000,
        riichi: [],
        tenpai: [],
      },
      {
        round_id: 'r2',
        kyoku_name: '東1局',
        win_type: 'ryukyoku',
        winner: null,
        loser: null,
        score: 0,
        riichi: [],
        tenpai: ['P2'],
      },
    ];

    // 第1局を「P2のロン和了（和了者: P2, 放銃者: P1）」に修正
    const modifiedHistory: RoundRecord[] = [
      {
        ...roundHistory[0],
        winner: 'P2',
        loser: 'P1',
      },
      roundHistory[1],
    ];

    const details = computeAllRoundsDetails(players, 25000, defaultRule, modifiedHistory);

    // 第1局で子P2が和了したため、親番はP2へ移動（輪荘）
    expect(details[0].kyokuName).toBe('東1局');
    expect(details[0].honba).toBe(0);
    expect(details[0].scoresAfter['P2']).toBe(33000);
    expect(details[0].scoresAfter['P1']).toBe(17000);

    // 第2局は東1局1本場ではなく「東2局 0本場」へ自動シフトしていること
    expect(details[1].kyokuName).toBe('東2局');
    expect(details[1].honba).toBe(0);

    // ゼロサム検算（合計100,000点）
    const totalScore = Object.values(details[1].scoresAfter).reduce((a, b) => a + b, 0);
    expect(totalScore).toBe(100000);
  });

  it('ダブロン修正時の計算整合性: 放銃者から2名分の打点が引かれ上家取りで供託が渡りゼロサムが維持されること', () => {
    // 第1局でP3がリーチ、P1がP2とP4へダブロン放銃（P2: 8000点, P4: 12000点）
    // 座順: P1(東), P2(南), P3(西), P4(北)
    // 放銃者P1から見て最も近い和了者はP2（上家取り）
    const roundHistory: RoundRecord[] = [
      {
        round_id: 'r1',
        kyoku_name: '東1局',
        win_type: 'multi_ron',
        winner: null,
        loser: 'P1',
        score: 0,
        riichi: ['P3'],
        tenpai: [],
        multi_wins: [
          { winner: 'P2', points_data: { total: 8000, han: 4, fu: 30 } },
          { winner: 'P4', points_data: { total: 12000, han: 5, fu: 30 } },
        ],
      },
    ];

    const details = computeAllRoundsDetails(players, 25000, defaultRule, roundHistory);
    const r1 = details[0];

    // P3はリーチで -1000 (24,000点)
    expect(r1.scoresAfter['P3']).toBe(24000);

    // P1はP2へ8000 + P4へ12000支払い = -20000 (5,000点)
    expect(r1.scoresAfter['P1']).toBe(5000);

    // P2は8000点 ＋ 供託1000点（上家取り） = +9000 (34,000点)
    expect(r1.scoresAfter['P2']).toBe(34000);

    // P4は12000点 (37,000点)
    expect(r1.scoresAfter['P4']).toBe(37000);

    // ゼロサム検算
    const totalScore = Object.values(r1.scoresAfter).reduce((a, b) => a + b, 0);
    expect(totalScore).toBe(100000);
  });
});

describe('Layer 4: 麻雀ドメイン境界値・エッジケース網羅検証', () => {
  const players = ['P1', 'P2', 'P3', 'P4']; // 座席: 1:東(起家), 2:南, 3:西, 4:北
  const defaultRule: RuleConfig = {
    basic: { init_score: 25000, return_score: 30000, game_length: 'hanchan', uma: [30, 10, -10, -30] },
    detail: {
      tobi_end: 'under_zero',
      west_extension: 'under_30000',
      agari_yame: true,
      tenpai_yame: true,
      riichi_pt: 1000,
    },
  };

  describe('1. 同点タイブレーク（起家・座順優先）と供託棒加算', () => {
    it('全員25,000点同点時: 起家から順に1位〜4位に厳格確定し、山分けされないこと', () => {
      const scores = { P1: 25000, P2: 25000, P3: 25000, P4: 25000 };
      const settlement = calculateGameSettlement(players, scores, defaultRule, 0);

      // 順位は座順通り
      expect(settlement[0].player).toBe('P1');
      expect(settlement[0].rank).toBe(1);
      expect(settlement[1].player).toBe('P2');
      expect(settlement[1].rank).toBe(2);
      expect(settlement[2].player).toBe('P3');
      expect(settlement[2].rank).toBe(3);
      expect(settlement[3].player).toBe('P4');
      expect(settlement[3].rank).toBe(4);

      // ウマ・オカが山分けされず個別に適用されること (オカ: 20pt)
      // 1位: (25000 - 30000)/1000 + 30 + 20 = 45.0
      // 2位: (25000 - 30000)/1000 + 10 = 5.0
      // 3位: (25000 - 30000)/1000 - 10 = -15.0
      // 4位: (25000 - 30000)/1000 - 30 = -35.0
      // 合計: 45 + 5 - 15 - 35 = 0
      expect(settlement[0].point).toBe(45);
      expect(settlement[1].point).toBe(5);
      expect(settlement[2].point).toBe(-15);
      expect(settlement[3].point).toBe(-35);
    });

    it('2位・3位同点時: 座順が前のプレイヤーが2位、後ろが3位になること', () => {
      const scores = { P1: 35000, P2: 25000, P3: 25000, P4: 15000 };
      const settlement = calculateGameSettlement(players, scores, defaultRule, 0);

      expect(settlement[0].player).toBe('P1');
      expect(settlement[0].rank).toBe(1);
      expect(settlement[1].player).toBe('P2');
      expect(settlement[1].rank).toBe(2);
      expect(settlement[2].player).toBe('P3');
      expect(settlement[2].rank).toBe(3);
      expect(settlement[3].player).toBe('P4');
      expect(settlement[3].rank).toBe(4);
    });

    it('トップ同点時に供託棒が残っている場合: 起家優先で上家に供託が全額加算され単独トップとなること', () => {
      // P1とP2が30,000点で同点トップ、供託棒が1本（1,000点）残存
      const scores = { P1: 30000, P2: 30000, P3: 20000, P4: 20000 };
      const settlement = calculateGameSettlement(players, scores, defaultRule, 1);

      // P1に1,000点が加算され31,000点で単独1位
      expect(settlement[0].player).toBe('P1');
      expect(settlement[0].finalScore).toBe(31000);
      expect(settlement[0].rank).toBe(1);

      expect(settlement[1].player).toBe('P2');
      expect(settlement[1].finalScore).toBe(30000);
      expect(settlement[1].rank).toBe(2);
    });
  });

  describe('2. トビ判定（0点ちょうど vs マイナス）の境界値', () => {
    it('under_zero（0点未満）: 0点ちょうどはトビとならず続行、-100点でトビ終了すること', () => {
      const ruleUnderZero: RuleConfig = {
        ...defaultRule,
        detail: { ...defaultRule.detail, tobi_end: 'under_zero' },
      };

      // 0点ちょうど: トビ終了しない（null）
      const zeroScores = { P1: 40000, P2: 30000, P3: 30000, P4: 0 };
      expect(checkGameEnd(zeroScores, 0, players, ruleUnderZero)).toBeNull();

      // -100点: トビ終了
      const minusScores = { P1: 40000, P2: 30000, P3: 30100, P4: -100 };
      expect(checkGameEnd(minusScores, 0, players, ruleUnderZero)).toBe('飛び終了（P4 が0点未満）');
    });

    it('zero_or_less（0点以下）: 0点ちょうどで即座にトビ終了すること', () => {
      const ruleZeroOrLess: RuleConfig = {
        ...defaultRule,
        detail: { ...defaultRule.detail, tobi_end: 'zero_or_less' },
      };

      const zeroScores = { P1: 40000, P2: 30000, P3: 30000, P4: 0 };
      expect(checkGameEnd(zeroScores, 0, players, ruleZeroOrLess)).toBe('飛び終了（P4 が0点以下）');
    });

    it('none（トビなし）: -5000点でもトビ終了しないこと', () => {
      const ruleNoTobi: RuleConfig = {
        ...defaultRule,
        detail: { ...defaultRule.detail, tobi_end: 'none' },
      };

      const minusScores = { P1: 50000, P2: 30000, P3: 25000, P4: -5000 };
      expect(checkGameEnd(minusScores, 0, players, ruleNoTobi)).toBeNull();
    });
  });

  describe('3. オーラスアガリ止め・テンパイ止め・サドンデス（西入）', () => {
    it('南4局（オーラス）で親がトップで和了: アガリ止めで対局終了すること', () => {
      // roundIdx: 7 (南4局、親は players[7 % 4] = P4)
      const scores = { P1: 20000, P2: 20000, P3: 20000, P4: 40000 };
      const history: RoundRecord[] = [
        {
          kyoku_name: '南4局',
          winner: 'P4', // 親
          loser: 'P1',
          win_type: 'ron',
          score: 3900,
          riichi: [],
        },
      ];

      const endReason = checkGameEnd(scores, 7, players, defaultRule, history);
      expect(endReason).toBe('アガリやめ（親トップ）');
    });

    it('南4局で親がトップでテンパイ流局: テンパイ止めで対局終了すること', () => {
      const scores = { P1: 20000, P2: 20000, P3: 20000, P4: 40000 };
      const history: RoundRecord[] = [
        {
          kyoku_name: '南4局',
          winner: null,
          loser: null,
          win_type: 'ryukyoku',
          score: 0,
          riichi: [],
          tenpai: ['P4'], // 親テンパイ
        },
      ];

      const endReason = checkGameEnd(scores, 7, players, defaultRule, history);
      expect(endReason).toBe('テンパイやめ（親トップ）');
    });

    it('南4局終了時に全員が返り点（30,000点）未満: 西入突入（続行）すること', () => {
      // roundIdx: 8 (西1局)、全員30,000点未満
      const scores = { P1: 28000, P2: 26000, P3: 24000, P4: 22000 };
      const history: RoundRecord[] = [
        {
          kyoku_name: '南4局',
          winner: 'P1',
          loser: 'P2',
          win_type: 'ron',
          score: 2000,
          riichi: [],
        },
      ];

      const endReason = checkGameEnd(scores, 8, players, defaultRule, history);
      // 西入突入のため終了せず続行（null）
      expect(endReason).toBeNull();
    });

    it('西入中に誰かが返り点（30,000点）に到達した局でサドンデス終了すること', () => {
      // 西1局（親はP1）、子P2がP3から満貫8000点ロンして 33000点でトップになり終了
      const scores = { P1: 27000, P2: 33000, P3: 20000, P4: 20000 };
      const history: RoundRecord[] = [
        { kyoku_name: '南4局', winner: 'P1', loser: 'P2', win_type: 'ron', score: 2000, riichi: [] },
        { kyoku_name: '西1局', winner: 'P2', loser: 'P3', win_type: 'ron', score: 8000, riichi: [] },
      ];

      // 子のアガリで親流れし roundIdx は 9 (西2局へ進む時点)
      const endReason = checkGameEnd(scores, 9, players, defaultRule, history);
      expect(endReason).toBe('サドンデス終了（トップ 33,000点）');
    });

    it('西4局終了（延長上限到達）で全員30,000点未満のままの場合: 延長終了すること', () => {
      // limitIdx = 8, limitIdx + 4 = 12 (西4局終了後のインデックス)
      const scores = { P1: 28000, P2: 26000, P3: 24000, P4: 22000 };
      const history: RoundRecord[] = [
        { kyoku_name: '西4局', winner: 'P1', loser: 'P2', win_type: 'ron', score: 2000, riichi: [] },
      ];

      const endReason = checkGameEnd(scores, 12, players, defaultRule, history);
      expect(endReason).toBe('西4局終了（延長終了）');
    });

    it('東風戦（tonpu）の場合: 東4局終了時にトップが30,000点未満なら南入すること', () => {
      const tonpuRule: RuleConfig = {
        basic: { init_score: 25000, return_score: 30000, game_length: 'tonpu' },
        detail: { west_extension: 'under_30000' },
      };
      // roundIdx: 4 (東4局終了後 = 南1局)、全員30000点未満
      const scores = { P1: 28000, P2: 26000, P3: 24000, P4: 22000 };
      const history: RoundRecord[] = [
        { kyoku_name: '東4局', winner: 'P1', loser: 'P2', win_type: 'ron', score: 2000, riichi: [] },
      ];

      const endReason = checkGameEnd(scores, 4, players, tonpuRule, history);
      // 南入するため終了せず続行（null）
      expect(endReason).toBeNull();
    });
  });

  describe('4. canDeclareRiichi（立直宣言可否判定）', () => {
    const defaultRule: RuleConfig = {
      basic: { init_score: 25000, return_score: 30000 },
      detail: { riichi_pt: 1000, tobi_end: 'under_zero' },
    };

    it('副露（チー・ポン・カン）しているプレイヤーは点数に関わらず立直不可', () => {
      expect(canDeclareRiichi(25000, defaultRule, true)).toBe(false);
      expect(canDeclareRiichi(1000, defaultRule, true)).toBe(false);
      expect(canDeclareRiichi(-1000, { ...defaultRule, detail: { ...defaultRule.detail, tobi_end: 'none' } }, true)).toBe(false);
    });

    describe('飛びなし（tobi_end: none）の場合', () => {
      const noneRule: RuleConfig = {
        ...defaultRule,
        detail: { ...defaultRule.detail, tobi_end: 'none' },
      };

      it('十分な点数がある場合は立直可能', () => {
        expect(canDeclareRiichi(25000, noneRule)).toBe(true);
      });

      it('1000点ちょうどの場合は立直可能', () => {
        expect(canDeclareRiichi(1000, noneRule)).toBe(true);
      });

      it('1000点未満（例: 500点）でも点棒を借りて立直可能', () => {
        expect(canDeclareRiichi(500, noneRule)).toBe(true);
      });

      it('0点でも立直可能', () => {
        expect(canDeclareRiichi(0, noneRule)).toBe(true);
      });

      it('箱下（マイナス点、例: -3000点）でも立直可能', () => {
        expect(canDeclareRiichi(-3000, noneRule)).toBe(true);
      });
    });

    describe('飛びあり・0点未満終了（tobi_end: under_zero、デフォルト）の場合', () => {
      it('1000点ちょうどは供託後0点でセーフのため立直可能', () => {
        expect(canDeclareRiichi(1000, defaultRule)).toBe(true);
      });

      it('1000点未満（例: 900点）は供託後マイナスになりトビ終了するため立直不可', () => {
        expect(canDeclareRiichi(900, defaultRule)).toBe(false);
      });

      it('0点やマイナス点では立直不可', () => {
        expect(canDeclareRiichi(0, defaultRule)).toBe(false);
        expect(canDeclareRiichi(-1000, defaultRule)).toBe(false);
      });
    });

    describe('飛びあり・0点以下終了（tobi_end: zero_or_less）の場合', () => {
      const zeroOrLessRule: RuleConfig = {
        ...defaultRule,
        detail: { ...defaultRule.detail, tobi_end: 'zero_or_less' },
      };

      it('1000点超（例: 1100点）であれば立直可能', () => {
        expect(canDeclareRiichi(1100, zeroOrLessRule)).toBe(true);
      });

      it('1000点ちょうどは供託後0点でトビ終了するため立直不可', () => {
        expect(canDeclareRiichi(1000, zeroOrLessRule)).toBe(false);
      });

      it('1000点未満は立直不可', () => {
        expect(canDeclareRiichi(900, zeroOrLessRule)).toBe(false);
      });
    });
  });

  describe('途中流局（mid_ryukyoku）と親進行・精算エッジケース検証', () => {
    const players = ['P1', 'P2', 'P3', 'P4'];

    it('途中流局（九種九牌等）: デフォルト設定では連荘（本場+1、親番維持）', () => {
      const defaultRule: RuleConfig = {
        basic: { init_score: 25000, return_score: 30000 },
        detail: {
          honba_pt: 300,
          riichi_pt: 1000,
          kyushu_kyuhai: 'renchan',
        },
      };

      const history: RoundRecord[] = [
        {
          round_id: 'r1',
          kyoku_name: '東1局',
          winner: null,
          loser: null,
          win_type: 'mid_ryukyoku',
          ryukyoku_type: 'kyushu_kyuhai',
          score: 0,
          riichi: [],
        },
      ];

      const details = computeAllRoundsDetails(players, 25000, defaultRule, history);
      expect(details.length).toBe(1);
      expect(details[0].resultType).toBe('mid_ryukyoku');
      // 親連荘のため次局は東1局1本場
      const state = recalculateState(players, 25000, defaultRule, history);
      expect(state.roundIdx).toBe(0);
      expect(state.honba).toBe(1);
    });

    it('途中流局: ルールで親流れ（ryukyoku）指定時は次局へ親が流れること', () => {
      const oyaNagareRule: RuleConfig = {
        basic: { init_score: 25000, return_score: 30000 },
        detail: {
          honba_pt: 300,
          riichi_pt: 1000,
          kyushu_kyuhai: 'ryukyoku',
        },
      };

      const history: RoundRecord[] = [
        {
          round_id: 'r1',
          kyoku_name: '東1局',
          winner: null,
          loser: null,
          win_type: 'mid_ryukyoku',
          ryukyoku_type: 'kyushu_kyuhai',
          score: 0,
          riichi: [],
        },
      ];

      const details = computeAllRoundsDetails(players, 25000, oyaNagareRule, history);
      expect(details.length).toBe(1);
      // 親流れだが流局のため本場は+1加算され、次局は東2局1本場
      const state = recalculateState(players, 25000, oyaNagareRule, history);
      expect(state.roundIdx).toBe(1);
      expect(state.honba).toBe(1);
    });

    it('精算計算: 4名全員同点（25000点）の場合、起家優先順位と合計0.0pt整合性', () => {
      const equalScores = { P1: 25000, P2: 25000, P3: 25000, P4: 25000 };
      const settlement = calculateGameSettlement(players, equalScores, {
        basic: { init_score: 25000, return_score: 30000, uma: [20, 10, -10, -20] },
      });

      // 起家（座席）順に1〜4位が割り振られる
      expect(settlement[0].player).toBe('P1');
      expect(settlement[0].rank).toBe(1);
      expect(settlement[1].player).toBe('P2');
      expect(settlement[1].rank).toBe(2);
      expect(settlement[2].player).toBe('P3');
      expect(settlement[2].rank).toBe(3);
      expect(settlement[3].player).toBe('P4');
      expect(settlement[3].rank).toBe(4);

      // 合計ポイントが完全ゼロサム（0.0）であること
      const totalPt = settlement.reduce((acc, s) => acc + s.point, 0);
      expect(Math.round(totalPt * 10) / 10).toBe(0);
    });

    it('精算計算: 残留供託棒がある場合、トップ（1位）が総取りすること', () => {
      // 4名の持ち点合計98,000点 ＋ 残留供託2本（2,000点） ＝ 100,000点
      const scores = { P1: 35000, P2: 29000, P3: 20000, P4: 14000 };
      // Mリーグルール（ウマ: [50, 10, -10, -30]、オカ込み）
      const settlement = calculateGameSettlement(players, scores, {
        basic: { init_score: 25000, return_score: 30000, uma: [50, 10, -10, -30] },
        detail: { riichi_pt: 1000 },
      }, 2);

      const p1 = settlement.find((s) => s.player === 'P1')!;
      expect(p1.rawScore).toBe(35000);
      expect(p1.finalScore).toBe(37000); // 35000 + 2000
      expect(p1.rank).toBe(1);
      // (37000 - 30000)/1000 + 50(オカ+ウマ) = 57.0pt
      expect(p1.point).toBe(57.0);

      // 全員合計が完全ゼロサム（0.0pt）になること
      const totalPt = settlement.reduce((acc, s) => acc + s.point, 0);
      expect(Math.round(totalPt * 10) / 10).toBe(0);
    });
  });
});


