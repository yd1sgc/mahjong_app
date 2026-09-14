import { describe, expect, it } from 'vitest';
import {
  computeAllRoundsDetails,
  recalculateState,
} from '../src/lib/mahjong/rules';
import { RoundRecord, RuleConfig } from '../src/types/mahjong';

describe('Layer 2: 局修正・巻き戻し（Undo）と状態再計算の完全性検証', () => {
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

  it('1. リーチ棒が発生した局のUndo: 持ち点と供託プールが完全復元されること', () => {
    // 東1局: P1とP2がリーチ宣言、流局で全員ノーテン
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: null,
      loser: null,
      win_type: 'ryukyoku',
      score: 0,
      riichi: ['P1', 'P2'],
      tenpai: [],
    };

    const history = [r1];
    const afterR1 = recalculateState(players, 25000, defaultRule, history);

    // リーチ棒2本供託（P1, P2が各-1000）、全員ノーテンで罰符移動なし、親不聴のため親流れ
    expect(afterR1.scores['P1']).toBe(24000);
    expect(afterR1.scores['P2']).toBe(24000);
    expect(afterR1.scores['P3']).toBe(25000);
    expect(afterR1.scores['P4']).toBe(25000);
    expect(afterR1.riichiStick).toBe(2);
    expect(afterR1.roundIdx).toBe(1); // 東2局へ
    expect(afterR1.honba).toBe(1);

    // Undo実行（最新局をpopして再計算）
    const undoneHistory = history.slice(0, -1);
    const restored = recalculateState(players, 25000, defaultRule, undoneHistory);

    // 対局開始時の初期状態に完全復元されること
    expect(restored.scores['P1']).toBe(25000);
    expect(restored.scores['P2']).toBe(25000);
    expect(restored.scores['P3']).toBe(25000);
    expect(restored.scores['P4']).toBe(25000);
    expect(restored.riichiStick).toBe(0);
    expect(restored.roundIdx).toBe(0);
    expect(restored.honba).toBe(0);
  });

  it('2. 供託持ち越し局の和了とUndo: 獲得供託が没収され前局の供託プールに完全復元されること', () => {
    // 東1局: 流局、供託1本発生
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: null,
      loser: null,
      win_type: 'ryukyoku',
      score: 0,
      riichi: ['P1'],
      tenpai: ['P1'], // 親テンパイで連荘
    };
    // 東1局1本場: P3が子ロン（P4から2000点＋1本場300点＋供託1000点獲得）
    const r2: RoundRecord = {
      round_id: 'r2',
      kyoku_name: '東1局',
      winner: 'P3',
      loser: 'P4',
      win_type: 'ron',
      score: 2000,
      riichi: [],
      tenpai: [],
    };

    const history = [r1, r2];
    const afterR2 = recalculateState(players, 25000, defaultRule, history);

    // P3: 24000(R1でノーテン罰符-1000) + 2000(素点) + 300(本場) + 1000(供託) = 27300
    // P4: 24000(R1でノーテン罰符-1000) - 2000(素点) - 300(本場) = 21700
    // P1: 25000 - 1000(リーチ) + 3000(テンパイ) = 27000
    expect(afterR2.scores['P3']).toBe(27300);
    expect(afterR2.scores['P4']).toBe(21700);
    expect(afterR2.scores['P1']).toBe(27000);
    expect(afterR2.riichiStick).toBe(0); // 供託は回収された
    expect(afterR2.roundIdx).toBe(1); // 子のアガリで東2局へ
    expect(afterR2.honba).toBe(0);

    // 東2局（R2）をUndo
    const undoneHistory = history.slice(0, -1);
    const restored = recalculateState(players, 25000, defaultRule, undoneHistory);

    // R1終了時の状態（供託1本、P3は24000、P4は24000、P1は27000、東1局1本場）に完全一致すること
    expect(restored.scores['P3']).toBe(24000);
    expect(restored.scores['P4']).toBe(24000);
    expect(restored.scores['P1']).toBe(27000);
    expect(restored.riichiStick).toBe(1);
    expect(restored.roundIdx).toBe(0);
    expect(restored.honba).toBe(1);
  });

  it('3. 親のアガリ（連荘）局のUndo: 本場と親番が連荘前に完全復元されること', () => {
    // 東1局: P1（親）が5800点ロン（放銃: P2）
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: 'P1',
      loser: 'P2',
      win_type: 'ron',
      score: 5800,
      riichi: [],
      tenpai: [],
    };

    const history = [r1];
    const afterR1 = recalculateState(players, 25000, defaultRule, history);

    expect(afterR1.scores['P1']).toBe(30800);
    expect(afterR1.scores['P2']).toBe(19200);
    expect(afterR1.roundIdx).toBe(0); // 連荘で東1局のまま
    expect(afterR1.honba).toBe(1); // 1本場

    // Undo実行
    const restored = recalculateState(players, 25000, defaultRule, []);
    expect(restored.scores['P1']).toBe(25000);
    expect(restored.scores['P2']).toBe(25000);
    expect(restored.roundIdx).toBe(0);
    expect(restored.honba).toBe(0);
  });

  it('4. チョンボ局のUndo: 満貫支払いが完全に相殺され元通りになること', () => {
    // 東1局: P2（子）がチョンボ（親P1に4000点、子P3,P4に各2000点支払い）
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: 'P2',
      loser: null,
      win_type: 'chombo',
      score: 0,
      riichi: [],
      tenpai: [],
    };

    const history = [r1];
    const afterChombo = recalculateState(players, 25000, defaultRule, history);

    expect(afterChombo.scores['P2']).toBe(17000); // 25000 - 8000
    expect(afterChombo.scores['P1']).toBe(29000); // 25000 + 4000
    expect(afterChombo.scores['P3']).toBe(27000); // 25000 + 2000
    expect(afterChombo.scores['P4']).toBe(27000); // 25000 + 2000
    // チョンボは局数・本場据え置き
    expect(afterChombo.roundIdx).toBe(0);
    expect(afterChombo.honba).toBe(0);

    // Undo実行
    const restored = recalculateState(players, 25000, defaultRule, []);
    expect(restored.scores['P2']).toBe(25000);
    expect(restored.scores['P1']).toBe(25000);
    expect(restored.scores['P3']).toBe(25000);
    expect(restored.scores['P4']).toBe(25000);
  });

  it('5. 局修正シミュレーション（過去の局のスコア訂正）: 後続の全スコアが正確に再計算されること', () => {
    // 3局進行:
    // R1: 東1局 P1（親）がP2から2000点ロン → 東1局1本場
    // R2: 東1局1本場 P2がツモ 1000-2000（計4000＋本場300） → 東2局
    // R3: 東2局 P3がP4から3900点ロン → 東3局
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: 'P1',
      loser: 'P2',
      win_type: 'ron',
      score: 2000,
      riichi: [],
      tenpai: [],
    };
    const r2: RoundRecord = {
      round_id: 'r2',
      kyoku_name: '東1局',
      winner: 'P2',
      loser: null,
      win_type: 'tsumo',
      score: 4000,
      riichi: [],
      tenpai: [],
    };
    const r3: RoundRecord = {
      round_id: 'r3',
      kyoku_name: '東2局',
      winner: 'P3',
      loser: 'P4',
      win_type: 'ron',
      score: 3900,
      riichi: [],
      tenpai: [],
    };

    const initialHistory = [r1, r2, r3];
    const stateBefore = recalculateState(players, 25000, defaultRule, initialHistory);

    // ここで「R1は2000点ではなく親満8000点だった」と判明して過去局を修正
    const correctedR1: RoundRecord = {
      ...r1,
      score: 8000,
    };
    const correctedHistory = [correctedR1, r2, r3];
    const stateAfterCorrection = recalculateState(players, 25000, defaultRule, correctedHistory);

    // P1は +6000点、P2は -6000点、P3とP4は変動なしであること
    expect(stateAfterCorrection.scores['P1']).toBe(stateBefore.scores['P1'] + 6000);
    expect(stateAfterCorrection.scores['P2']).toBe(stateBefore.scores['P2'] - 6000);
    expect(stateAfterCorrection.scores['P3']).toBe(stateBefore.scores['P3']);
    expect(stateAfterCorrection.scores['P4']).toBe(stateBefore.scores['P4']);
    // 親番・本場の局進行推移は影響を受けないこと
    expect(stateAfterCorrection.roundIdx).toBe(stateBefore.roundIdx);
    expect(stateAfterCorrection.honba).toBe(stateBefore.honba);
  });

  it('6. 2局連続Undo: 2局前終了時の状態と1点の狂いもなく一致すること', () => {
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: 'P1',
      loser: 'P2',
      win_type: 'ron',
      score: 2900,
      riichi: ['P3'],
      tenpai: [],
    };
    const r2: RoundRecord = {
      round_id: 'r2',
      kyoku_name: '東1局',
      winner: 'P4',
      loser: 'P1',
      win_type: 'ron',
      score: 5200,
      riichi: [],
      tenpai: [],
    };
    const r3: RoundRecord = {
      round_id: 'r3',
      kyoku_name: '東2局',
      winner: null,
      loser: null,
      win_type: 'ryukyoku',
      score: 0,
      riichi: ['P2'],
      tenpai: ['P2'],
    };

    // R1終了時点のスナップショットを記録
    const r1OnlyState = recalculateState(players, 25000, defaultRule, [r1]);

    // R3まで進める
    const fullHistory = [r1, r2, r3];
    const fullState = recalculateState(players, 25000, defaultRule, fullHistory);
    expect(fullState.roundHistory.length).toBe(3);

    // 2局連続Undo実行（R3をpop、さらにR2をpop）
    const twoUndoneHistory = fullHistory.slice(0, 1);
    const restoredState = recalculateState(players, 25000, defaultRule, twoUndoneHistory);

    // R1終了時点と完全一致
    expect(restoredState.scores).toEqual(r1OnlyState.scores);
    expect(restoredState.roundIdx).toBe(r1OnlyState.roundIdx);
    expect(restoredState.honba).toBe(r1OnlyState.honba);
    expect(restoredState.riichiStick).toBe(r1OnlyState.riichiStick);
  });

  it('7. computeAllRoundsDetails: 各局のスコア差分合計が常にゼロ和を維持すること', () => {
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: 'P1',
      loser: 'P2',
      win_type: 'ron',
      score: 3900,
      riichi: ['P3'],
      tenpai: [],
    };
    const r2: RoundRecord = {
      round_id: 'r2',
      kyoku_name: '東1局',
      winner: 'P1',
      loser: null,
      win_type: 'chombo',
      score: 0,
      riichi: [],
      tenpai: [],
    };
    const r3: RoundRecord = {
      round_id: 'r3',
      kyoku_name: '東1局',
      winner: 'P2',
      loser: null,
      win_type: 'tsumo',
      score: 3000,
      riichi: [],
      tenpai: [],
    };

    const details = computeAllRoundsDetails(players, 25000, defaultRule, [r1, r2, r3]);
    expect(details.length).toBe(3);

    for (const round of details) {
      // 当該局の全座席の scoreDelta の合計は 0 であること
      const sumDelta = round.seatDetails.reduce((sum, s) => sum + s.scoreDelta, 0);
      expect(sumDelta).toBe(0);

      // 前後スコアの差分が seatDetails の scoreDelta と一致すること
      for (const seat of round.seatDetails) {
        const calculatedDelta = round.scoresAfter[seat.player] - round.scoresBefore[seat.player];
        expect(seat.scoreDelta).toBe(calculatedDelta);
      }
    }
  });

  it('8. チョンボのloserフォールバック: loserにチョンボ者が指定されていても満貫払いが実行されること', () => {
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: null,
      loser: 'P1', // 親のチョンボ
      win_type: 'chombo',
      score: 0,
      riichi: [],
      tenpai: [],
    };
    const state = recalculateState(players, 25000, defaultRule, [r1]);
    expect(state.scores['P1']).toBe(13000); // 25000 - 12000 (親チョンボ: 4000x3)
    expect(state.scores['P2']).toBe(29000); // 25000 + 4000
    expect(state.scores['P3']).toBe(29000);
    expect(state.scores['P4']).toBe(29000);
  });

  it('9. チョンボの不正データ防御: 不正なプレイヤー名や空の場合にスコアが破損しないこと', () => {
    const r1: RoundRecord = {
      round_id: 'r1',
      kyoku_name: '東1局',
      winner: null,
      loser: null,
      win_type: 'chombo',
      score: 0,
      riichi: [],
      tenpai: [],
    };
    const state = recalculateState(players, 25000, defaultRule, [r1]);
    // スコアが壊れず初期状態（25000）を維持すること
    expect(state.scores['P1']).toBe(25000);
    expect(state.scores['P2']).toBe(25000);
    expect(state.scores['P3']).toBe(25000);
    expect(state.scores['P4']).toBe(25000);
  });
});
