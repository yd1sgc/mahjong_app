import { describe, expect, it } from 'vitest';
import {
  validateRuleInput,
  validateMemberInput,
  validateGroupInput,
  MAX_MEMBER_NAME_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_RULE_NAME_LENGTH,
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

    it('文字数上限: 15文字ちょうどは通過し、16文字以上は拒絶すること', () => {
      // 15文字ちょうど
      const res15 = validateRuleInput({
        name: '親族麻雀ルール（過去データ用）',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
      });
      expect(res15.valid).toBe(true);

      // 16文字
      const res16 = validateRuleInput({
        name: '親族麻雀ルール（過去データ用）X',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
      });
      expect(res16.valid).toBe(false);
      expect(res16.error).toBe(`ルール名は${MAX_RULE_NAME_LENGTH}文字以内で入力してください`);
    });

    it('禁止文字: 絵文字や改行を含むルール名を拒絶すること', () => {
      const resEmoji = validateRuleInput({
        name: '麻雀ルール🀄',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
      });
      expect(resEmoji.valid).toBe(false);
      expect(resEmoji.error).toBe('絵文字は使用できません');

      const resNewline = validateRuleInput({
        name: 'ルール\nA',
        initScore: 25000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
      });
      expect(resNewline.valid).toBe(false);
      expect(resNewline.error).toBe('改行や特殊な制御文字は使用できません');
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

    it('文字数上限: 8文字ちょうどは通過し、9文字以上は拒絶すること', () => {
      // 8文字ちょうど
      const res8 = validateMemberInput('オッチャンテスト', existingMembers);
      expect(res8.valid).toBe(true);
      expect(res8.trimmedName).toBe('オッチャンテスト');

      // 9文字
      const res9 = validateMemberInput('オッチャンテストX', existingMembers);
      expect(res9.valid).toBe(false);
      expect(res9.error).toBe(`メンバー名は${MAX_MEMBER_NAME_LENGTH}文字以内で入力してください`);
    });

    it('禁止文字: 絵文字や改行を含むメンバー名を拒絶すること', () => {
      const resEmoji = validateMemberInput('佐藤😀', existingMembers);
      expect(resEmoji.valid).toBe(false);
      expect(resEmoji.error).toBe('絵文字は使用できません');

      const resTab = validateMemberInput('佐藤\t太郎', existingMembers);
      expect(resTab.valid).toBe(false);
      expect(resTab.error).toBe('改行や特殊な制御文字は使用できません');
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

    it('文字数上限: 10文字ちょうどは通過し、11文字以上は拒絶すること', () => {
      // 10文字ちょうど
      const res10 = validateGroupInput('親族麻雀部テスト１０', existingGroups);
      expect(res10.valid).toBe(true);
      expect(res10.trimmedName).toBe('親族麻雀部テスト１０');

      // 11文字
      const res11 = validateGroupInput('親族麻雀部テスト１０Ｘ', existingGroups);
      expect(res11.valid).toBe(false);
      expect(res11.error).toBe(`グループ名は${MAX_GROUP_NAME_LENGTH}文字以内で入力してください`);
    });

    it('禁止文字: 絵文字や改行を含むグループ名を拒絶すること', () => {
      const resEmoji = validateGroupInput('親族麻雀部🀄', existingGroups);
      expect(resEmoji.valid).toBe(false);
      expect(resEmoji.error).toBe('絵文字は使用できません');

      const resNewline = validateGroupInput('親族\n麻雀部', existingGroups);
      expect(resNewline.valid).toBe(false);
      expect(resNewline.error).toBe('改行や特殊な制御文字は使用できません');
    });
  });
});
