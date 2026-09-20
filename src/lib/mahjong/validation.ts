/**
 * ルール設定およびメンバー・グループ管理の純粋バリデーションモジュール (validation.ts)
 * ReactやDOM非依存の純粋関数群
 */

export const MAX_MEMBER_NAME_LENGTH = 8;
export const MAX_GROUP_NAME_LENGTH = 10;
export const MAX_RULE_NAME_LENGTH = 15;

// 絵文字チェック（Unicode Extended Pictographic）
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;
// 改行・タブ等の制御文字チェック
const CONTROL_CHAR_REGEX = /[\r\n\t\x00-\x1f\x7f]/;

/**
 * 禁止文字（改行・制御文字・絵文字）が含まれているかを検査する純粋関数
 */
export function containsForbiddenChars(text: string): { forbidden: boolean; reason?: string } {
  if (CONTROL_CHAR_REGEX.test(text)) {
    return { forbidden: true, reason: '改行や特殊な制御文字は使用できません' };
  }
  if (EMOJI_REGEX.test(text)) {
    return { forbidden: true, reason: '絵文字は使用できません' };
  }
  return { forbidden: false };
}

export interface RuleInputData {
  name: string;
  initScore: number;
  returnScore: number;
  uma: number[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface MemberValidationResult extends ValidationResult {
  trimmedName: string;
}

/**
 * 対局ルール設定の入力バリデーション
 */
export function validateRuleInput(data: RuleInputData): ValidationResult {
  const trimmedName = data.name ? data.name.trim() : '';
  if (!trimmedName) {
    return { valid: false, error: 'ルール名を入力してください' };
  }

  const charCheck = containsForbiddenChars(trimmedName);
  if (charCheck.forbidden) {
    return { valid: false, error: charCheck.reason };
  }

  if (trimmedName.length > MAX_RULE_NAME_LENGTH) {
    return { valid: false, error: `ルール名は${MAX_RULE_NAME_LENGTH}文字以内で入力してください` };
  }

  if (typeof data.initScore !== 'number' || typeof data.returnScore !== 'number') {
    return { valid: false, error: '配給原点および返し点は数値である必要があります' };
  }

  if (data.initScore > data.returnScore) {
    return { valid: false, error: '返し点は配給原点以上である必要があります' };
  }

  if (!Array.isArray(data.uma) || data.uma.length !== 4) {
    return { valid: false, error: 'ウマは4名分の数値を指定してください' };
  }

  const umaSum = data.uma.reduce((sum, val) => sum + (Number(val) || 0), 0);
  if (Math.abs(umaSum) > 0.0001) {
    return { valid: false, error: `ウマの合計は0である必要があります（現在: ${umaSum > 0 ? '+' : ''}${umaSum}）` };
  }

  return { valid: true };
}

export interface ExistingMemberItem {
  member_id: string;
  member_name: string;
}

/**
 * メンバー新規登録・編集時の入力バリデーション
 */
export function validateMemberInput(
  name: string,
  existingMembers: ExistingMemberItem[] = [],
  currentMemberId?: string
): MemberValidationResult {
  const trimmed = name ? name.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'メンバー名を入力してください', trimmedName: '' };
  }

  const charCheck = containsForbiddenChars(trimmed);
  if (charCheck.forbidden) {
    return { valid: false, error: charCheck.reason, trimmedName: trimmed };
  }

  if (trimmed.length > MAX_MEMBER_NAME_LENGTH) {
    return {
      valid: false,
      error: `メンバー名は${MAX_MEMBER_NAME_LENGTH}文字以内で入力してください`,
      trimmedName: trimmed,
    };
  }

  const lower = trimmed.toLowerCase();
  const isDuplicate = existingMembers.some(
    (m) => (!currentMemberId || m.member_id !== currentMemberId) && m.member_name.toLowerCase() === lower
  );

  if (isDuplicate) {
    return { valid: false, error: '同名のメンバーが既に登録されています', trimmedName: trimmed };
  }

  return { valid: true, trimmedName: trimmed };
}

export interface ExistingGroupItem {
  group_id: string;
  group_name: string;
}

/**
 * グループ新規登録・編集時の入力バリデーション
 */
export function validateGroupInput(
  name: string,
  existingGroups: ExistingGroupItem[] = [],
  currentGroupId?: string
): MemberValidationResult {
  const trimmed = name ? name.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'グループ名を入力してください', trimmedName: '' };
  }

  const charCheck = containsForbiddenChars(trimmed);
  if (charCheck.forbidden) {
    return { valid: false, error: charCheck.reason, trimmedName: trimmed };
  }

  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    return {
      valid: false,
      error: `グループ名は${MAX_GROUP_NAME_LENGTH}文字以内で入力してください`,
      trimmedName: trimmed,
    };
  }

  const lower = trimmed.toLowerCase();
  const isDuplicate = existingGroups.some(
    (g) => (!currentGroupId || g.group_id !== currentGroupId) && g.group_name.toLowerCase() === lower
  );

  if (isDuplicate) {
    return { valid: false, error: '同名のグループが既に登録されています', trimmedName: trimmed };
  }

  return { valid: true, trimmedName: trimmed };
}
