import { describe, it, expect } from 'vitest';
import { calculateGameSettlement } from '../src/lib/mahjong/rules';
import { buildSimpleGamePayload, validateSimpleGameScores } from '../src/lib/mahjong/simpleGame';

describe('Simple Game Settlement & Payload Logic', () => {
  const ruleConfig = {
    detail: {
      uma_1: 30,
      uma_2: 10,
      uma_3: -10,
      uma_4: -30,
      return_pt: 30000,
      init_pt: 25000,
      oka_pt: 20,
    },
  };

  it('validates 100,000 points total correctly', () => {
    expect(validateSimpleGameScores([25000, 25000, 25000, 25000])).toBe(true);
    expect(validateSimpleGameScores([40000, 30000, 20000, 10000])).toBe(true);
    expect(validateSimpleGameScores([40000, 30000, 20000, 9900])).toBe(false);
    expect(validateSimpleGameScores([40000, 30000, 20000, 10100])).toBe(false);
  });

  it('calculates settlement and builds correct game & participants payload', () => {
    const input = {
      gameId: 'test-game-uuid',
      groupId: 'test-group-id',
      playedAt: '2026-09-11T12:00:00.000Z',
      ruleName: 'Mリーグルール',
      ruleConfig,
      players: [
        { seat: 1, memberId: 'm1', playerName: '東家A', score: 45000, wasGroupMember: 1 },
        { seat: 2, memberId: 'm2', playerName: '南家B', score: 28000, wasGroupMember: 1 },
        { seat: 3, memberId: 'm3', playerName: '西家C', score: 17000, wasGroupMember: 1 },
        { seat: 4, memberId: 'm4', playerName: '北家D', score: 10000, wasGroupMember: 0 },
      ],
    };

    const payload = buildSimpleGamePayload(input);

    // games レコードの検証
    expect(payload.game.game_id).toBe('test-game-uuid');
    expect(payload.game.group_id).toBe('test-group-id');
    expect(payload.game.game_mode).toBe('simple');
    expect(payload.game.status).toBe('completed');
    expect(payload.game.rule_name_snapshot).toBe('Mリーグルール');
    expect(payload.game.sync_target).toBe(1);
    expect(payload.game.is_synced).toBe(1);

    // game_participants レコードの検証
    expect(payload.participants).toHaveLength(4);

    // 順位順またはseat順の検証
    const p1 = payload.participants.find((p) => p.seat === 1)!;
    const p2 = payload.participants.find((p) => p.seat === 2)!;
    const p3 = payload.participants.find((p) => p.seat === 3)!;
    const p4 = payload.participants.find((p) => p.seat === 4)!;

    expect(p1.rank).toBe(1);
    expect(p1.final_score).toBe(45000);
    expect(p1.point).toBe(65.0); // (45000-30000)/1000 + 30(uma) + 20(oka) = 15 + 30 + 20 = 65.0

    expect(p2.rank).toBe(2);
    expect(p2.final_score).toBe(28000);
    expect(p2.point).toBe(8.0); // (28000-30000)/1000 + 10(uma) = -2 + 10 = +8.0

    expect(p3.rank).toBe(3);
    expect(p3.final_score).toBe(17000);
    expect(p3.point).toBe(-23.0); // (17000-30000)/1000 - 10(uma) = -13 - 10 = -23.0

    expect(p4.rank).toBe(4);
    expect(p4.final_score).toBe(10000);
    expect(p4.point).toBe(-50.0); // (10000-30000)/1000 - 30(uma) = -20 - 30 = -50.0

    // 四者の合計ptが厳密に 0.0pt（ゼロサム）であること
    const totalPt = payload.participants.reduce((sum, p) => sum + p.point, 0);
    expect(Math.round(totalPt * 10) / 10).toBe(0.0);
  });

  it('handles tie-breaking with seat priority correctly', () => {
    const input = {
      gameId: 'test-tie-uuid',
      groupId: 'test-group-id',
      playedAt: '2026-09-11T12:00:00.000Z',
      ruleName: 'Mリーグルール',
      ruleConfig,
      players: [
        { seat: 1, memberId: 'm1', playerName: '東家A', score: 30000, wasGroupMember: 1 },
        { seat: 2, memberId: 'm2', playerName: '南家B', score: 30000, wasGroupMember: 1 },
        { seat: 3, memberId: 'm3', playerName: '西家C', score: 20000, wasGroupMember: 1 },
        { seat: 4, memberId: 'm4', playerName: '北家D', score: 20000, wasGroupMember: 1 },
      ],
    };

    const payload = buildSimpleGamePayload(input);
    const p1 = payload.participants.find((p) => p.seat === 1)!;
    const p2 = payload.participants.find((p) => p.seat === 2)!;
    const p3 = payload.participants.find((p) => p.seat === 3)!;
    const p4 = payload.participants.find((p) => p.seat === 4)!;

    // 起家優先で東家が1位、南家が2位
    expect(p1.rank).toBe(1);
    expect(p2.rank).toBe(2);
    // 西家が3位、北家が4位
    expect(p3.rank).toBe(3);
    expect(p4.rank).toBe(4);

    const totalPt = payload.participants.reduce((sum, p) => sum + p.point, 0);
    expect(Math.round(totalPt * 10) / 10).toBe(0.0);
  });
});
