import { describe, it, expect } from 'vitest';
import { YakumanDisplayItem } from '@/hooks/useStatsData';
import { GameData } from '@/lib/mahjong/statsCalc';

// stats/page.tsx 内のフィルタリングロジックを純粋関数としてテスト検証
function filterYakumanRecords(
  records: YakumanDisplayItem[],
  effectiveGames: { game_id: string }[],
  includeGuests: boolean,
  guestNames: Set<string>
): YakumanDisplayItem[] {
  const validGameIds = new Set(effectiveGames.map((g) => g.game_id));
  return records.filter((yr) => {
    // 1. 試合フィルター
    if (!validGameIds.has(yr.game_id)) return false;
    // 2. ゲストフィルター
    if (!includeGuests && guestNames.has(yr.member_name)) return false;
    return true;
  });
}

describe('Yakuman records stats filter integration', () => {
  // テスト用モックデータ
  const mockGames: GameData[] = [
    {
      game_id: 'g-2026-shinseki',
      played_at: '2026-09-05T00:00:00Z',
      group_id: 'grp-shinseki',
      rule_name: '親族麻雀',
      rule_config: {} as any,
      participants: [
        { seat: 1, member_id: 'm-otchan', name: 'オッチャン', final_score: 45000, rank: 1, point: 55 },
        { seat: 2, member_id: 'm-guest', name: 'ゲストA', final_score: 25000, rank: 2, point: 5 },
        { seat: 3, member_id: 'm-taro', name: '太郎', final_score: 20000, rank: 3, point: -15 },
        { seat: 4, member_id: 'm-jiro', name: '次郎', final_score: 10000, rank: 4, point: -45 },
      ],
    },
    {
      game_id: 'g-2025-mleague',
      played_at: '2025-01-05T10:00:00Z',
      group_id: 'grp-league',
      rule_name: 'Mリーグ',
      rule_config: {} as any,
      participants: [
        { seat: 1, member_id: 'm-taro', name: '太郎', final_score: 40000, rank: 1, point: 50 },
        { seat: 2, member_id: 'm-guest', name: 'ゲストA', final_score: 30000, rank: 2, point: 10 },
        { seat: 3, member_id: 'm-jiro', name: '次郎', final_score: 20000, rank: 3, point: -10 },
        { seat: 4, member_id: 'm-otchan', name: 'オッチャン', final_score: 10000, rank: 4, point: -50 },
      ],
    },
  ];

  const mockYakumans: YakumanDisplayItem[] = [
    {
      id: 'y-1',
      game_id: 'g-2026-shinseki',
      round_id: 'r-1',
      member_id: 'm-otchan',
      member_name: 'オッチャン',
      played_at: '2026/09/05',
      yakuman_name: '大三元',
      win_type_label: 'ツモ',
    },
    {
      id: 'y-2',
      game_id: 'g-2026-shinseki',
      round_id: 'r-2',
      member_id: 'm-guest',
      member_name: 'ゲストA',
      played_at: '2026/09/05',
      yakuman_name: '四暗刻',
      win_type_label: 'ロン',
    },
    {
      id: 'y-3',
      game_id: 'g-2025-mleague',
      round_id: null,
      member_id: 'm-taro',
      member_name: '太郎',
      played_at: '2025/01/05',
      yakuman_name: '国士無双',
      win_type_label: '-',
    },
  ];

  const guestNames = new Set(['ゲストA']);

  it('filters by year correctly', () => {
    // 2026年の試合のみ
    const games2026 = mockGames.filter((g) => g.played_at.startsWith('2026'));
    const result2026 = filterYakumanRecords(mockYakumans, games2026, true, guestNames);
    expect(result2026.length).toBe(2);
    expect(result2026.map((r) => r.yakuman_name)).toEqual(['大三元', '四暗刻']);

    // 2025年の試合のみ
    const games2025 = mockGames.filter((g) => g.played_at.startsWith('2025'));
    const result2025 = filterYakumanRecords(mockYakumans, games2025, true, guestNames);
    expect(result2025.length).toBe(1);
    expect(result2025[0].yakuman_name).toBe('国士無双');

    // 2024年（該当試合なし）
    const games2024 = mockGames.filter((g) => g.played_at.startsWith('2024'));
    const result2024 = filterYakumanRecords(mockYakumans, games2024, true, guestNames);
    expect(result2024.length).toBe(0);
  });

  it('filters by group correctly', () => {
    // 親族麻雀グループのみ
    const gamesShinseki = mockGames.filter((g) => g.group_id === 'grp-shinseki');
    const resultShinseki = filterYakumanRecords(mockYakumans, gamesShinseki, true, guestNames);
    expect(resultShinseki.length).toBe(2);

    // Mリーググループのみ
    const gamesLeague = mockGames.filter((g) => g.group_id === 'grp-league');
    const resultLeague = filterYakumanRecords(mockYakumans, gamesLeague, true, guestNames);
    expect(resultLeague.length).toBe(1);
    expect(resultLeague[0].member_name).toBe('太郎');
  });

  it('filters by rule name correctly', () => {
    // 親族麻雀ルールのみ
    const gamesShinsekiRule = mockGames.filter((g) => g.rule_name === '親族麻雀');
    const result = filterYakumanRecords(mockYakumans, gamesShinsekiRule, true, guestNames);
    expect(result.length).toBe(2);

    // 一般アリアリ（該当なし）
    const gamesOtherRule = mockGames.filter((g) => g.rule_name === '一般アリアリ');
    const resultOther = filterYakumanRecords(mockYakumans, gamesOtherRule, true, guestNames);
    expect(resultOther.length).toBe(0);
  });

  it('filters out guests when includeGuests is false', () => {
    // 全試合対象、ゲスト除外
    const resultNoGuests = filterYakumanRecords(mockYakumans, mockGames, false, guestNames);
    expect(resultNoGuests.length).toBe(2);
    expect(resultNoGuests.some((r) => r.member_name === 'ゲストA')).toBe(false);
    expect(resultNoGuests.map((r) => r.member_name)).toEqual(['オッチャン', '太郎']);

    // 全試合対象、ゲスト含む
    const resultWithGuests = filterYakumanRecords(mockYakumans, mockGames, true, guestNames);
    expect(resultWithGuests.length).toBe(3);
    expect(resultWithGuests.some((r) => r.member_name === 'ゲストA')).toBe(true);
  });

  it('filters by specific game selection (accordion filter)', () => {
    // 試合 g-2026-shinseki だけを個別選択
    const selectedGames = mockGames.filter((g) => g.game_id === 'g-2026-shinseki');
    const result = filterYakumanRecords(mockYakumans, selectedGames, true, guestNames);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.game_id === 'g-2026-shinseki')).toBe(true);
  });
});
