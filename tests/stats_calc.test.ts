import { describe, expect, it } from 'vitest';
import {
  calculateGameStats,
  calculateRoundStats,
  calculateChartData,
  calculateRecords,
  calculateCompatibilityMatrix,
  GameData,
  RoundData,
} from '../src/lib/mahjong/statsCalc';

describe('Layer 5: 成績集計ロジック正本検証 (statsCalc.ts)', () => {
  // テスト用対局モックデータ（2半荘）
  const mockGames: GameData[] = [
    {
      game_id: 'g1',
      played_at: '2026-01-01T10:00:00Z',
      group_id: 'grp1',
      rule_id: 'r1',
      rule_name: 'Mリーグ',
      rule_config: {},
      participants: [
        { seat: 1, member_id: 'm1', name: 'PlayerA', final_score: 45000, rank: 1, point: 65.0 },
        { seat: 2, member_id: 'm2', name: 'PlayerB', final_score: 30000, rank: 2, point: 10.0 },
        { seat: 3, member_id: 'm3', name: 'PlayerC', final_score: 15000, rank: 3, point: -25.0 },
        { seat: 4, member_id: 'm4', name: 'PlayerD', final_score: 10000, rank: 4, point: -50.0 },
      ],
    },
    {
      game_id: 'g2',
      played_at: '2026-01-01T12:00:00Z',
      group_id: 'grp1',
      rule_id: 'r1',
      rule_name: 'Mリーグ',
      rule_config: {},
      participants: [
        { seat: 1, member_id: 'm1', name: 'PlayerA', final_score: 38000, rank: 1, point: 58.0 },
        { seat: 2, member_id: 'm3', name: 'PlayerC', final_score: 28000, rank: 2, point: 8.0 },
        { seat: 3, member_id: 'm2', name: 'PlayerB', final_score: 22000, rank: 3, point: -18.0 },
        { seat: 4, member_id: 'm4', name: 'PlayerD', final_score: 12000, rank: 4, point: -48.0 },
      ],
    },
  ];

  describe('1. calculateGameStats (試合成績集計)', () => {
    it('基本成績（ゲーム数、通算pt、平均着順、連対率、ラス回避率）が正確に算出されること', () => {
      const stats = calculateGameStats(mockGames, 'totalPt');
      expect(stats.length).toBe(4);

      // 1位: PlayerA (2戦2勝)
      const pA = stats.find((s) => s.name === 'PlayerA')!;
      expect(pA.games).toBe(2);
      expect(pA.totalPt).toBe(123.0); // 65 + 58
      expect(pA.avgRank).toBe(1.0);
      expect(pA.rentaiRate).toBe(100.0);
      expect(pA.rasuAvoidRate).toBe(100.0);
      expect(pA.rank1Rate).toBe(100.0);
      expect(pA.ranks).toEqual([2, 0, 0, 0]);

      // PlayerD (2戦2ラス)
      const pD = stats.find((s) => s.name === 'PlayerD')!;
      expect(pD.games).toBe(2);
      expect(pD.totalPt).toBe(-98.0); // -50 + -48
      expect(pD.avgRank).toBe(4.0);
      expect(pD.rentaiRate).toBe(0.0);
      expect(pD.rasuAvoidRate).toBe(0.0);
      expect(pD.ranks).toEqual([0, 0, 0, 2]);
    });

    it('各sortByオプション（totalPt, okaNashiPt, avgRank, games）で正しくソートされること', () => {
      const byPt = calculateGameStats(mockGames, 'totalPt');
      expect(byPt[0].name).toBe('PlayerA');
      expect(byPt[byPt.length - 1].name).toBe('PlayerD');

      const byAvgRank = calculateGameStats(mockGames, 'avgRank');
      expect(byAvgRank[0].name).toBe('PlayerA'); // 1.0
      expect(byAvgRank[byAvgRank.length - 1].name).toBe('PlayerD'); // 4.0

      const byGames = calculateGameStats(mockGames, 'games');
      expect(byGames.length).toBe(4);

      const byOkaNashi = calculateGameStats(mockGames, 'okaNashiPt');
      expect(byOkaNashi[0].name).toBe('PlayerA');
    });
  });

  describe('2. calculateRoundStats (局詳細成績・正本SQL仕様準拠検証)', () => {
    const mockRounds: RoundData[] = [
      // R1: PlayerAがPlayerBからロン（満貫8000点、本場300点、供託1000点獲得）
      // 正本仕様: 平均打点・放銃点には本場・供託を含めない base_point (8000) を使用する
      {
        round_id: 'rnd1',
        game_id: 'g1',
        round_index: 0,
        kyoku_name: '東1局',
        honba: 1,
        result_type: 'ron',
        seats: [
          {
            seat: 1,
            member_id: 'm1',
            score_delta: 9300,
            base_point: 8000,
            honba_point: 300,
            kyotaku_point: 1000,
            penalty_point: 0,
            is_winner: 1,
            is_loser: 0,
            is_riichi: 1,
            is_furo: 0,
            is_tenpai: 1,
          },
          {
            seat: 2,
            member_id: 'm2',
            score_delta: -8300,
            base_point: -8000,
            honba_point: -300,
            kyotaku_point: 0,
            penalty_point: 0,
            is_winner: 0,
            is_loser: 1,
            is_riichi: 0,
            is_furo: 0,
            is_tenpai: 0,
          },
          {
            seat: 3,
            member_id: 'm3',
            score_delta: 0,
            base_point: 0,
            honba_point: 0,
            kyotaku_point: 0,
            penalty_point: 0,
            is_winner: 0,
            is_loser: 0,
            is_riichi: 0,
            is_furo: 0,
            is_tenpai: 0,
          },
          {
            seat: 4,
            member_id: 'm4',
            score_delta: -1000,
            base_point: 0,
            honba_point: 0,
            kyotaku_point: -1000, // リーチ棒供託
            penalty_point: 0,
            is_winner: 0,
            is_loser: 0,
            is_riichi: 1,
            is_furo: 0,
            is_tenpai: 0,
          },
        ],
      },
      // R2: 流局（PlayerAとPlayerCがテンパイ: 2名テンパイで各+1500点、BとDがノーテン各-1500点）
      {
        round_id: 'rnd2',
        game_id: 'g1',
        round_index: 1,
        kyoku_name: '東1局',
        honba: 2,
        result_type: 'ryukyoku',
        seats: [
          {
            seat: 1,
            member_id: 'm1',
            score_delta: 1500,
            base_point: 0,
            honba_point: 0,
            kyotaku_point: 0,
            penalty_point: 0,
            is_winner: 0,
            is_loser: 0,
            is_riichi: 0,
            is_furo: 0,
            is_tenpai: 1,
          },
          {
            seat: 2,
            member_id: 'm2',
            score_delta: -1500,
            base_point: 0,
            honba_point: 0,
            kyotaku_point: 0,
            penalty_point: 0,
            is_winner: 0,
            is_loser: 0,
            is_riichi: 0,
            is_furo: 0,
            is_tenpai: 0,
          },
          {
            seat: 3,
            member_id: 'm3',
            score_delta: 1500,
            base_point: 0,
            honba_point: 0,
            kyotaku_point: 0,
            penalty_point: 0,
            is_winner: 0,
            is_loser: 0,
            is_riichi: 0,
            is_furo: 0,
            is_tenpai: 1,
          },
          {
            seat: 4,
            member_id: 'm4',
            score_delta: -1500,
            base_point: 0,
            honba_point: 0,
            kyotaku_point: 0,
            penalty_point: 0,
            is_winner: 0,
            is_loser: 0,
            is_riichi: 0,
            is_furo: 0,
            is_tenpai: 0,
          },
        ],
      },
    ];

    it('平均打点・放銃点が本場や供託を含まない base_point で厳密に集計されること', () => {
      const { roundStats } = calculateRoundStats(mockGames, mockRounds);

      const pA = roundStats.find((s) => s.name === 'PlayerA')!;
      // 和了1回、打点は 8000点（9300点ではない）
      expect(pA.avgAgari).toBe(8000);
      expect(pA.riichiAvgAgari).toBe(8000);
      expect(pA.agariRate).toBe(50.0); // 2局中1回

      const pB = roundStats.find((s) => s.name === 'PlayerB')!;
      // 放銃1回、放銃点は 8000点（8300点ではない）
      expect(pB.avgHouju).toBe(8000);
      expect(pB.houjuRate).toBe(50.0);
    });

    it('供託収支（kyotakuPoint）が正本DB値をそのまま正負累計していること', () => {
      const { roundStats } = calculateRoundStats(mockGames, mockRounds);

      const pA = roundStats.find((s) => s.name === 'PlayerA')!;
      expect(pA.kyotakuPoint).toBe(1000); // 供託棒1本獲得

      const pD = roundStats.find((s) => s.name === 'PlayerD')!;
      expect(pD.kyotakuPoint).toBe(-1000); // リーチ棒1本供託
    });

    it('終局時に場に残った供託リーチ棒がトップ（1位）のkyotakuPointに正しく加算され、全体ゼロサムになること', () => {
      // R2でPlayerBがリーチをかけて流局終了した場合（場に供託棒1本残り）
      const roundsWithRem: RoundData[] = [
        mockRounds[0],
        {
          ...mockRounds[1],
          seats: mockRounds[1].seats.map((s) =>
            s.seat === 2 ? { ...s, is_riichi: 1, kyotaku_point: -1000 } : s
          ),
        },
      ];
      const { roundStats } = calculateRoundStats(mockGames, roundsWithRem);
      // g1のトップはPlayerA
      const pA = roundStats.find((s) => s.name === 'PlayerA')!;
      // R1獲得 1000 + 終局時トップ取り 1000 = 2000
      expect(pA.kyotakuPoint).toBe(2000);

      // PlayerB: R2でリーチ供託 -1000
      const pB = roundStats.find((s) => s.name === 'PlayerB')!;
      expect(pB.kyotakuPoint).toBe(-1000);

      // 全体ゼロサム検証
      const sum = roundStats.reduce((acc, s) => acc + s.kyotakuPoint, 0);
      expect(sum).toBe(0);
    });

    it('流局テンパイ料（notenBappu）が場3000点配分仕様（2人テンパイ各+1500/-1500）に厳密準拠していること', () => {
      const { roundStats } = calculateRoundStats(mockGames, mockRounds);

      const pA = roundStats.find((s) => s.name === 'PlayerA')!;
      const pC = roundStats.find((s) => s.name === 'PlayerC')!;
      const pB = roundStats.find((s) => s.name === 'PlayerB')!;
      const pD = roundStats.find((s) => s.name === 'PlayerD')!;

      expect(pA.notenBappu).toBe(1500);
      expect(pC.notenBappu).toBe(1500);
      expect(pB.notenBappu).toBe(-1500);
      expect(pD.notenBappu).toBe(-1500);
    });

    it('被立直放銃・被副露放銃・被ダマ放銃が和了者の属性に基づいて正確に分類されること（同局内他者立直時のダマ放銃を含む）', () => {
      const houjuTestRounds: RoundData[] = [
        // R1: PlayerDが立直しているが、和了者はダマのPlayerA。PlayerBが放銃。
        // → PlayerBの被ダマ放銃が1件（被立直放銃にはならないこと）
        {
          round_id: 'hr1',
          game_id: 'g1',
          round_index: 0,
          kyoku_name: '東1局',
          honba: 0,
          result_type: 'ron',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 3900, base_point: 3900, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 1 },
            { seat: 2, member_id: 'm2', score_delta: -3900, base_point: -3900, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 1, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 4, member_id: 'm4', score_delta: -1000, base_point: 0, honba_point: 0, kyotaku_point: -1000, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 1, is_furo: 0, is_tenpai: 1 },
          ],
        },
        // R2: PlayerCが副露して和了。PlayerBが放銃。
        {
          round_id: 'hr2',
          game_id: 'g1',
          round_index: 1,
          kyoku_name: '東2局',
          honba: 0,
          result_type: 'ron',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 2, member_id: 'm2', score_delta: -2000, base_point: -2000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 1, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: 2000, base_point: 2000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 0, is_furo: 1, is_tenpai: 1 },
            { seat: 4, member_id: 'm4', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
          ],
        },
        // R3: PlayerDが立直して和了。PlayerBが放銃。
        {
          round_id: 'hr3',
          game_id: 'g1',
          round_index: 2,
          kyoku_name: '東3局',
          honba: 0,
          result_type: 'ron',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 2, member_id: 'm2', score_delta: -8000, base_point: -8000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 1, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 4, member_id: 'm4', score_delta: 8000, base_point: 8000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 1, is_furo: 0, is_tenpai: 1 },
          ],
        },
      ];

      const { roundStats } = calculateRoundStats(mockGames, houjuTestRounds);
      const pB = roundStats.find((s) => s.name === 'PlayerB')!;

      // 3局中3回放銃
      expect(pB.houjuRate).toBe(100.0);
      // 各1回ずつ放銃（33.3%ずつ）
      expect(pB.damaHoujuRate).toBe(33.3);
      expect(pB.furoHoujuRate).toBe(33.3);
      expect(pB.riichiHoujuRate).toBe(33.3);
    });

    it('ダブロン発生時に立直 > 副露 > ダマの優先度で1件集計され、放銃内訳の合計が100%を維持すること', () => {
      const multiRonRounds: RoundData[] = [
        // PlayerA（立直）とPlayerC（ダマ）へのダブロンにPlayerBが放銃
        {
          round_id: 'mr1',
          game_id: 'g1',
          round_index: 0,
          kyoku_name: '東1局',
          honba: 0,
          result_type: 'multi_ron',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 8000, base_point: 8000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 1, is_furo: 0, is_tenpai: 1 },
            { seat: 2, member_id: 'm2', score_delta: -12000, base_point: -12000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 1, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: 4000, base_point: 4000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 1 },
            { seat: 4, member_id: 'm4', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
          ],
        },
      ];

      const { roundStats } = calculateRoundStats(mockGames, multiRonRounds);
      const pB = roundStats.find((s) => s.name === 'PlayerB')!;

      // 放銃1回に対し、立直優先で被立直放銃が100%
      expect(pB.riichiHoujuRate).toBe(100.0);
      expect(pB.furoHoujuRate).toBe(0.0);
      expect(pB.damaHoujuRate).toBe(0.0);
    });

    it('局収支（kyokuShuuchi）が全局のscore_delta合計から正確に四捨五入整数で算出されること', () => {
      const { roundStats } = calculateRoundStats(mockGames, mockRounds);
      const pA = roundStats.find((s) => s.name === 'PlayerA')!;
      const pB = roundStats.find((s) => s.name === 'PlayerB')!;

      // PlayerA: R1 (+9300) + R2 (+1500) = +10800 / 2局 = +5400
      expect(pA.kyokuShuuchi).toBe(5400);

      // PlayerB: R1 (-8300) + R2 (-1500) = -9800 / 2局 = -4900
      expect(pB.kyokuShuuchi).toBe(-4900);
    });

    it('親番・子番がkyoku_nameから正確に判定され、親子別成績（局数・連荘率・局収支・和了率・放銃率・平均点）が算出されること', () => {
      // 3局のモック
      // R1: 東1局 (親: seat 1 = PlayerA) → PlayerA和了 (親満 12000点、PlayerB放銃)
      // R2: 東1局 1本場 (親: seat 1 = PlayerA) → 流局 (PlayerAテンパイ +1500, PlayerB/C/Dノーテン -500/ノーテン罰符)
      // R3: 東2局 (親: seat 2 = PlayerB) → PlayerAがPlayerBから子満 8000点和了 (PlayerB親被弾)
      const oyakoTestRounds: RoundData[] = [
        {
          round_id: 'or1',
          game_id: 'g1',
          round_index: 0,
          kyoku_name: '東1局',
          honba: 0,
          result_type: 'ron',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 12000, base_point: 12000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 1 },
            { seat: 2, member_id: 'm2', score_delta: -12000, base_point: -12000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 1, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 4, member_id: 'm4', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
          ],
        },
        {
          round_id: 'or2',
          game_id: 'g1',
          round_index: 1,
          kyoku_name: '東1局 1本場',
          honba: 1,
          result_type: 'ryukyoku',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 3000, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 1 },
            { seat: 2, member_id: 'm2', score_delta: -1000, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: -1000, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 4, member_id: 'm4', score_delta: -1000, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
          ],
        },
        {
          round_id: 'or3',
          game_id: 'g1',
          round_index: 2,
          kyoku_name: '東2局',
          honba: 0,
          result_type: 'ron',
          seats: [
            { seat: 1, member_id: 'm1', score_delta: 8000, base_point: 8000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 1, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 1 },
            { seat: 2, member_id: 'm2', score_delta: -8000, base_point: -8000, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 1, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 3, member_id: 'm3', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
            { seat: 4, member_id: 'm4', score_delta: 0, base_point: 0, honba_point: 0, kyotaku_point: 0, penalty_point: 0, is_winner: 0, is_loser: 0, is_riichi: 0, is_furo: 0, is_tenpai: 0 },
          ],
        },
      ];

      const { roundStats } = calculateRoundStats(mockGames, oyakoTestRounds);
      const pA = roundStats.find((s) => s.name === 'PlayerA')!;
      const pB = roundStats.find((s) => s.name === 'PlayerB')!;

      // PlayerAの親子指標
      // 親局: 2局 (R1, R2), 子局: 1局 (R3)
      expect(pA.oyaKyoku).toBe(2);
      expect(pA.koKyoku).toBe(1);
      // 連荘率: R1(和了)+R2(流局テンパイ) で 2/2 = 100.0%
      expect(pA.oyaRenchanRate).toBe(100.0);
      // 親局収支: (+12000 + +3000) / 2 = +7500
      expect(pA.oyaKyokuShuuchi).toBe(7500);
      // 子局収支: +8000 / 1 = +8000
      expect(pA.koKyokuShuuchi).toBe(8000);
      // 親和了率: 1/2 = 50.0%, 子和了率: 1/1 = 100.0%
      expect(pA.oyaAgariRate).toBe(50.0);
      expect(pA.koAgariRate).toBe(100.0);
      // 親平均打点: 12000, 子平均打点: 8000
      expect(pA.oyaAvgAgariPt).toBe(12000);
      expect(pA.koAvgAgariPt).toBe(8000);

      // PlayerBの親子指標
      // 親局: 1局 (R3), 子局: 2局 (R1, R2)
      expect(pB.oyaKyoku).toBe(1);
      expect(pB.koKyoku).toBe(2);
      // 連荘率: R3で放銃したため連荘ゼロ = 0.0%
      expect(pB.oyaRenchanRate).toBe(0.0);
      // 親局収支: -8000 / 1 = -8000
      expect(pB.oyaKyokuShuuchi).toBe(-8000);
      // 子局収支: (-12000 + -1000) / 2 = -6500
      expect(pB.koKyokuShuuchi).toBe(-6500);
      // 親放銃率: 1/1 = 100.0%, 子放銃率: 1/2 = 50.0%
      expect(pB.oyaHoujuRate).toBe(100.0);
      expect(pB.koHoujuRate).toBe(50.0);
    });
  });

  describe('3. calculateChartData (推移グラフデータ)', () => {
    it('開始点0から始まり、各半荘のポイントが累積加算されること', () => {
      const chartMembers = ['PlayerA', 'PlayerB'];
      const chart = calculateChartData(mockGames, chartMembers);

      // 開始、G1、G2 の計3ステップ
      expect(chart.length).toBe(3);
      expect(chart[0].label).toBe('開始');
      expect(chart[0].values['PlayerA']).toBe(0);
      expect(chart[0].values['PlayerB']).toBe(0);

      expect(chart[1].label).toBe('G1');
      expect(chart[1].values['PlayerA']).toBe(65.0);
      expect(chart[1].values['PlayerB']).toBe(10.0);

      expect(chart[2].label).toBe('G2');
      expect(chart[2].values['PlayerA']).toBe(123.0); // 65 + 58
      expect(chart[2].values['PlayerB']).toBe(-8.0); // 10 + (-18)
    });
  });

  describe('4. calculateRecords (レコード集計)', () => {
    it('最高得点Top5、最低得点Top5、および連勝記録（歴代・現在更新中）が正しく抽出されること', () => {
      const records = calculateRecords(mockGames);

      // 最高得点: PlayerA の 45000点 がトップ
      expect(records.top5[0].name).toBe('PlayerA');
      expect(records.top5[0].score).toBe(45000);

      // 最低得点: PlayerD の 10000点 がワースト
      expect(records.bottom5[0].name).toBe('PlayerD');
      expect(records.bottom5[0].score).toBe(10000);

      // 歴代連勝記録: PlayerA が G1, G2 で 2連勝
      expect(records.streaks.length).toBe(1);
      expect(records.streaks[0].name).toBe('PlayerA');
      expect(records.streaks[0].maxStreak).toBe(2);
      expect(records.streaks[0].achievedDate).toBe('2026-01-01');

      // 現在更新中の連勝: PlayerA は直近（G2）まで2連勝が継続中
      expect(records.activeStreaks.length).toBe(1);
      expect(records.activeStreaks[0].name).toBe('PlayerA');
      expect(records.activeStreaks[0].currentStreak).toBe(2);
      expect(records.activeStreaks[0].lastPlayedAt).toBe('2026-01-01');
    });

    it('連勝記録が最大連勝とその1つ下（2連勝以上）に絞り込まれ、古い順でソートされること', () => {
      // 複数プレイヤーの連勝シミュレーション対局
      const streakGames: GameData[] = [
        // 2026-01-01: P1 1位
        {
          game_id: 'sg1',
          played_at: '2026-01-01T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm1', name: 'P1', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm2', name: 'P2', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        // 2026-01-02: P1 1位 (P1 2連勝)
        {
          game_id: 'sg2',
          played_at: '2026-01-02T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm1', name: 'P1', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm2', name: 'P2', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        // 2026-01-03: P1 1位 (P1 3連勝)
        {
          game_id: 'sg3',
          played_at: '2026-01-03T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm1', name: 'P1', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm2', name: 'P2', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        // 2026-01-04: P1 1位 (P1 4連勝達成)
        {
          game_id: 'sg4',
          played_at: '2026-01-04T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm1', name: 'P1', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm2', name: 'P2', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        // 2026-01-05: P2 1位 (P1 4着で連勝ストップ)
        {
          game_id: 'sg5',
          played_at: '2026-01-05T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm2', name: 'P2', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm1', name: 'P1', final_score: 10000, rank: 4, point: -50 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 30000, rank: 2, point: 10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 20000, rank: 3, point: -10 },
          ],
        },
        // 2026-01-06: P2 1位 (P2 2連勝)
        {
          game_id: 'sg6',
          played_at: '2026-01-06T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm2', name: 'P2', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm1', name: 'P1', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        // 2026-01-07: P2 1位 (P2 3連勝達成・現在も更新中)
        {
          game_id: 'sg7',
          played_at: '2026-01-07T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm2', name: 'P2', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm1', name: 'P1', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm3', name: 'P3', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm4', name: 'P4', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        // 2026-01-08: P3が2連勝（過去の記録）を作るが、4連勝の1つ下（3連勝）未満なので除外されるべき
        {
          game_id: 'sg8',
          played_at: '2026-01-08T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm3', name: 'P3', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm1', name: 'P1', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm4', name: 'P4', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm5', name: 'P5', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        {
          game_id: 'sg9',
          played_at: '2026-01-09T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm3', name: 'P3', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm1', name: 'P1', final_score: 30000, rank: 2, point: 10 },
            { seat: 3, member_id: 'm4', name: 'P4', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm5', name: 'P5', final_score: 10000, rank: 4, point: -50 },
          ],
        },
        {
          game_id: 'sg10',
          played_at: '2026-01-10T10:00:00Z',
          group_id: 'grp1',
          rule_id: 'r1',
          rule_name: 'M',
          rule_config: {},
          participants: [
            { seat: 1, member_id: 'm1', name: 'P1', final_score: 40000, rank: 1, point: 50 },
            { seat: 2, member_id: 'm3', name: 'P3', final_score: 10000, rank: 4, point: -50 },
            { seat: 3, member_id: 'm4', name: 'P4', final_score: 20000, rank: 3, point: -10 },
            { seat: 4, member_id: 'm5', name: 'P5', final_score: 30000, rank: 2, point: 10 },
          ],
        },
      ];

      const res = calculateRecords(streakGames);

      // 全体最大は P1 の 4連勝。よって足切り閾値は max(2, 4 - 1) = 3連勝。
      // P3 は 2連勝なので streaks から除外される。
      expect(res.streaks.length).toBe(2);
      expect(res.streaks[0].name).toBe('P1');
      expect(res.streaks[0].maxStreak).toBe(4);
      expect(res.streaks[1].name).toBe('P2');
      expect(res.streaks[1].maxStreak).toBe(3);

      // activeStreaks（現在更新中・直近2連勝以上）:
      // P2 は sg7（2026-01-07）で3連勝して以降対局しておらず、連続1着が維持されているため3連勝中。
      expect(res.activeStreaks.length).toBe(1);
      expect(res.activeStreaks[0].name).toBe('P2');
      expect(res.activeStreaks[0].currentStreak).toBe(3);
    });
  });

  describe('5. calculateCompatibilityMatrix (相性マトリクス)', () => {
    it('直接対決pt差が正負反対称（A対B = -(B対A)）で成立すること', () => {
      const members = ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD'];
      const matrix = calculateCompatibilityMatrix(mockGames, members);

      // G1: A(65) - B(10) = +55
      // G2: A(58) - B(-18) = +76
      // 合計: 55 + 76 = +131
      const aVsB = matrix.get('PlayerA')!.get('PlayerB')!;
      const bVsA = matrix.get('PlayerB')!.get('PlayerA')!;

      expect(aVsB).toBe(131.0);
      expect(bVsA).toBe(-131.0);
      expect(aVsB + bVsA).toBe(0); // 正負反対称
    });
  });
});
