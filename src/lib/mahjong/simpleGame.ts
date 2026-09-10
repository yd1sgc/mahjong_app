import { RuleConfig } from '@/types/mahjong';
import { Database } from '@/types/database';
import { calculateGameSettlement } from './rules';

export interface SimpleGamePlayerInput {
  seat: number; // 1 | 2 | 3 | 4
  memberId: string;
  playerName: string;
  score: number;
  wasGroupMember?: number;
}

export interface BuildSimpleGameInput {
  gameId: string;
  groupId: string;
  playedAt?: string;
  ruleName: string;
  ruleConfig: RuleConfig;
  passcode?: string;
  players: SimpleGamePlayerInput[];
}

export type GameInsert = Database['public']['Tables']['games']['Insert'];
export type ParticipantInsert = Database['public']['Tables']['game_participants']['Insert'];

export interface SimpleGamePayload {
  game: GameInsert;
  participants: ParticipantInsert[];
}

/**
 * 4名の持ち点合計が100,000点（四麻標準）であるか検証する。
 */
export function validateSimpleGameScores(scores: number[], expectedTotal: number = 100000): boolean {
  if (scores.length !== 4) return false;
  const total = scores.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
  return total === expectedTotal;
}

/**
 * 簡易対局（結果のみ入力）用の games レコードおよび game_participants レコード群を生成する。
 * 起家・座席順優先のタイブレークおよびゼロサム端数調整済みのウマオカptを自動付与する。
 */
export function buildSimpleGamePayload(input: BuildSimpleGameInput): SimpleGamePayload {
  const {
    gameId,
    groupId,
    playedAt = new Date().toISOString(),
    ruleName,
    ruleConfig,
    passcode = '0000',
    players,
  } = input;

  // 1. seat 順 (1..4) に整列
  const sortedBySeat = [...players].sort((a, b) => a.seat - b.seat);
  const playerNames = sortedBySeat.map((p) => p.playerName);
  const scoreMap: Record<string, number> = {};
  sortedBySeat.forEach((p) => {
    scoreMap[p.playerName] = p.score;
  });

  // 2. 既存の純粋関数 calculateGameSettlement で順位・ウマオカptを算出
  const settlements = calculateGameSettlement(
    playerNames,
    scoreMap,
    ruleConfig,
    0 // 供託リーチ棒は結果入力時点では0
  );

  // 3. game レコード
  const game: GameInsert = {
    game_id: gameId,
    group_id: groupId,
    played_at: playedAt,
    passcode,
    rule_name_snapshot: ruleName,
    rule_config_snapshot: ruleConfig as any,
    status: 'completed',
    game_mode: 'simple',
    sync_target: 1,
    is_synced: 1,
  };

  // 4. game_participants レコード群
  const participants: ParticipantInsert[] = sortedBySeat.map((p) => {
    const st = settlements.find((s) => s.seat === p.seat);
    return {
      game_id: gameId,
      seat: p.seat,
      member_id: p.memberId,
      player_name_snapshot: p.playerName,
      final_score: p.score,
      rank: st?.rank ?? p.seat,
      point: st?.point ?? 0.0,
      was_group_member: p.wasGroupMember ?? 1,
    };
  });

  return {
    game,
    participants,
  };
}
