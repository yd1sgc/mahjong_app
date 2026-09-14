import { describe, expect, it } from 'vitest';
import {
  validateRuleInput,
  validateMemberInput,
  validateGroupInput,
} from '../src/lib/mahjong/validation';

describe('Layer 3: ルール・メンバー管理バリデーション検証 (management.test.ts)', () => {
  describe('1. validateRuleInput (ルール設定の整合性検証)', () => {
    it('正常系: ウマ合計が0かつ返し点≧配給原点の場合に通過すること', () => {
      // Mリーグルール: 25000点持ち30000点返し、ウマ [50, 10, -10, -30] (※オカ20含め+50/+10/-10/-30でウマ合計+20ではなくウマ自体は[30, 10, -10, -30]で合計0)
      const res = validateRuleInput({
        name: 'Mリーグ公式',
        initScore: 25000,
        returnScore: 30000,
        uma: [30, 10, -10, -30],
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('異常系: ウマの合計が0にならない場合（非ゼロ和）、保存を拒絶すること', () => {
      // ウマ合計が +10 の不正設定
      const resPositive = validateRuleInput({
        name: '不正ルール1',
        initScore: 25000,
        returnScore: 30000,
        uma: [30, 10, -10, -20],
      });
      expect(resPositive.valid).toBe(false);
      expect(resPositive.error).toContain('ウマの合計は0である必要があります');

      // ウマ合計が -10 の不正設定
      const resNegative = validateRuleInput({
        name: '不正ルール2',
        initScore: 25000,
        returnScore: 30000,
        uma: [20, 10, -10, -30],
      });
      expect(resNegative.valid).toBe(false);
      expect(resNegative.error).toContain('ウマの合計は0である必要があります');
    });

    it('異常系: 返し点 < 配給原点 の逆転設定を拒絶すること', () => {
      const res = validateRuleInput({
        name: '逆転ルール',
        initScore: 30000,
        returnScore: 25000,
        uma: [10, 5, -5, -10],
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('返し点は配給原点以上である必要があります');
    });

    it('異常系: ルール名が空文字または空白のみの場合に拒絶すること', () => {
      const resEmpty = validateRuleInput({
        name: '',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
      });
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.error).toBe('ルール名を入力してください');

      const resWhitespace = validateRuleInput({
        name: '   ',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
      });
      expect(resWhitespace.valid).toBe(false);
      expect(resWhitespace.error).toBe('ルール名を入力してください');
    });

    it('異常系: ウマの配列要素数が4でない場合に拒絶すること', () => {
      const res = validateRuleInput({
        name: '要素数不足ルール',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, -10],
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('ウマは4名分の数値を指定してください');
    });
  });

  describe('2. validateMemberInput (メンバー追加・編集の整合性検証)', () => {
    const existingMembers = [
      { member_id: 'm1', member_name: '田中' },
      { member_id: 'm2', member_name: '佐藤' },
      { member_id: 'm3', member_name: 'Alice' },
    ];

    it('正常系: 新規メンバー名が余白を含んでいても自動トリムされ有効となること', () => {
      const res = validateMemberInput('  鈴木  ', existingMembers);
      expect(res.valid).toBe(true);
      expect(res.trimmedName).toBe('鈴木');
    });

    it('異常系: 同名メンバー（大文字小文字問わず）の重複登録を拒絶すること', () => {
      // 完全一致
      const resExact = validateMemberInput('田中', existingMembers);
      expect(resExact.valid).toBe(false);
      expect(resExact.error).toBe('同名のメンバーが既に登録されています');

      // 大文字小文字違い（alice と Alice）
      const resCase = validateMemberInput('alice', existingMembers);
      expect(resCase.valid).toBe(false);
      expect(resCase.error).toBe('同名のメンバーが既に登録されています');
    });

    it('編集時: 自身の名前をそのまま維持する場合は重複とみなさないこと', () => {
      const res = validateMemberInput('Alice', existingMembers, 'm3');
      expect(res.valid).toBe(true);
      expect(res.trimmedName).toBe('Alice');
    });

    it('編集時: 他の既存メンバーと同名に変更しようとした場合は拒絶すること', () => {
      const res = validateMemberInput('田中', existingMembers, 'm3');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('同名のメンバーが既に登録されています');
    });

    it('異常系: 空文字または空白のみのメンバー名を拒絶すること', () => {
      const resEmpty = validateMemberInput('', existingMembers);
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.error).toBe('メンバー名を入力してください');

      const resSpace = validateMemberInput('   ', existingMembers);
      expect(resSpace.valid).toBe(false);
      expect(resSpace.error).toBe('メンバー名を入力してください');
    });
  });

  describe('3. validateGroupInput (グループ作成・編集の整合性検証)', () => {
    const existingGroups = [
      { group_id: 'g1', group_name: '麻雀部' },
      { group_id: 'g2', group_name: '親族麻雀' },
    ];

    it('正常系: 新規グループ名が登録できること', () => {
      const res = validateGroupInput('新グループ', existingGroups);
      expect(res.valid).toBe(true);
      expect(res.trimmedName).toBe('新グループ');
    });

    it('異常系: 重複グループ名を拒絶すること', () => {
      const res = validateGroupInput('麻雀部', existingGroups);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('同名のグループが既に登録されています');
    });

    it('異常系: 空文字グループ名を拒絶すること', () => {
      const res = validateGroupInput('   ', existingGroups);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('グループ名を入力してください');
    });
  });
});
