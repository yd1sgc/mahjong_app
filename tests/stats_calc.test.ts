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
    it('最高得点Top5、最低得点Top5、および2連勝以上の連勝記録が正しく抽出されること', () => {
      const records = calculateRecords(mockGames);

      // 最高得点: PlayerA の 45000点 がトップ
      expect(records.top5[0].name).toBe('PlayerA');
      expect(records.top5[0].score).toBe(45000);

      // 最低得点: PlayerD の 10000点 がワースト
      expect(records.bottom5[0].name).toBe('PlayerD');
      expect(records.bottom5[0].score).toBe(10000);

      // 連勝記録: PlayerA が G1, G2 で 2連勝
      expect(records.streaks.length).toBe(1);
      expect(records.streaks[0].name).toBe('PlayerA');
      expect(records.streaks[0].maxStreak).toBe(2);
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
