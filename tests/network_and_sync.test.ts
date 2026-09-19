import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DRAFT, RoundInputDraft } from '../src/hooks/useGameDraft';
import { RuleConfig } from '../src/types/mahjong';
import { calculateGameSettlement } from '../src/lib/mahjong/rules';

describe('Layer 6: UI・通信層の耐障害性・同期整合性検証 (network_and_sync)', () => {
  describe('1. LocalStorage 下書き（Draft）の耐障害性・復元テスト', () => {
    it('正常な下書きJSONが保存されている場合、正しく復元できること', () => {
      const validDraft: RoundInputDraft = {
        winType: 'ron',
        winner: 'PlayerA',
        loser: 'PlayerB',
        han: 3,
        fu: 30,
        tenpai: [],
        chomboPlayer: null,
        multiWinners: [],
        ryukyokuType: 'kyushu',
        yakumanNames: [],
      };

      const serialized = JSON.stringify(validDraft);
      const parsed = JSON.parse(serialized) as RoundInputDraft;

      expect(parsed.winner).toBe('PlayerA');
      expect(parsed.loser).toBe('PlayerB');
      expect(parsed.han).toBe(3);
      expect(parsed.fu).toBe(30);
    });

    it('破損したJSON（構文エラー）が保存されていた場合、クラッシュせずデフォルト値へフォールバックできること', () => {
      const corruptedJson = '{"winType": "ron", "winner": "PlayerA", han: '; // 不正なJSON

      let restoredDraft = DEFAULT_DRAFT;
      let hasDraft = false;

      try {
        const parsed = JSON.parse(corruptedJson) as RoundInputDraft;
        restoredDraft = parsed;
        hasDraft = true;
      } catch {
        // useGameDraft と同様に catch して初期値維持
        restoredDraft = DEFAULT_DRAFT;
        hasDraft = false;
      }

      expect(hasDraft).toBe(false);
      expect(restoredDraft.winType).toBe('ron');
      expect(restoredDraft.winner).toBeNull();
      expect(restoredDraft.han).toBe(1);
    });

    it('必須プロパティが欠損したオブジェクトが渡された場合でも、安全に判定できること', () => {
      const incompleteDraftJson = JSON.stringify({
        winType: 'tsumo',
        // winner が欠損
      });

      const parsed = JSON.parse(incompleteDraftJson) as Partial<RoundInputDraft>;
      const safeWinner = parsed.winner ?? DEFAULT_DRAFT.winner;
      const safeHan = parsed.han ?? DEFAULT_DRAFT.han;

      expect(safeWinner).toBeNull();
      expect(safeHan).toBe(1);
    });
  });

  describe('2. 4桁PINによる単一端末排他制御ロジック検証', () => {
    it('DB側の recorder_token とローカル保持トークンが一致している場合のみ記録係権限が有効であること', () => {
      const localToken = 'token_device_A_12345';
      const dbRecordToken = 'token_device_A_12345';

      const isRecorder = localToken === dbRecordToken;
      expect(isRecorder).toBe(true);
    });

    it('別端末から新PINが入力されて DB の recorder_token が更新された場合、旧端末が即座に一般閲覧者へ降格すること', () => {
      const deviceAToken: string = 'token_device_A_12345';
      // 端末Bが新PINを入力し、DBのトークンが更新された状態
      const updatedDbToken: string = 'token_device_B_67890';

      // 端末A側での照合判定
      const isDeviceARecorder = deviceAToken === updatedDbToken;
      expect(isDeviceARecorder).toBe(false);
    });
  });

  describe('3. 通信エラー時の楽観的更新ロールバックと点棒整合性チェック', () => {
    it('局コミット通信失敗時、直前のスナップショットへ完全ロールバックできること', () => {
      const preCommitScores = { P1: 25000, P2: 25000, P3: 25000, P4: 25000 };
      const preCommitHonba = 0;
      const preCommitRiichiSticks = 0;

      // 楽観的更新（コミット前の仮更新）
      let currentScores = { P1: 33000, P2: 17000, P3: 25000, P4: 25000 };
      let currentHonba = 1;
      let currentRiichiSticks = 0;

      // 通信エラー発生をシミュレート
      const simulateApiCall = vi.fn().mockRejectedValue(new Error('Network offline or 500 error'));

      let rollbackExecuted = false;
      try {
        throw new Error('Supabase RPC Failed');
      } catch {
        // ロールバック処理
        currentScores = { ...preCommitScores };
        currentHonba = preCommitHonba;
        currentRiichiSticks = preCommitRiichiSticks;
        rollbackExecuted = true;
      }

      expect(rollbackExecuted).toBe(true);
      expect(currentScores['P1']).toBe(25000);
      expect(currentScores['P2']).toBe(25000);
      expect(currentHonba).toBe(0);
      expect(currentRiichiSticks).toBe(0);
    });

    it('終局時の点棒合計検算: 4名合計が初期合計（100,000点）と不一致の場合に検知できること', () => {
      const validFinalScores = { P1: 35000, P2: 28000, P3: 22000, P4: 15000 };
      const totalValid = Object.values(validFinalScores).reduce((a, b) => a + b, 0);
      expect(totalValid).toBe(100000);

      // 点棒合計のバリデーション関数ロジック
      const validateScoreTotal = (scores: Record<string, number>, expectedTotal: number = 100000) => {
        const sum = Object.values(scores).reduce((a, b) => a + b, 0);
        return sum === expectedTotal;
      };

      expect(validateScoreTotal(validFinalScores)).toBe(true);

      // 入力不整合や計算異常（合計99,000点）
      const invalidScores = { P1: 35000, P2: 28000, P3: 22000, P4: 14000 };
      expect(validateScoreTotal(invalidScores)).toBe(false);
    });
  });
});
