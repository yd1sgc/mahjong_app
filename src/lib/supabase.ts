/**
 * Supabase クライアント初期化モジュール
 * ブラウザから直接通信する静的SPA仕様（完全無料枠）
 *
 * 環境変数が未設定（ビルド時やテスト時）でもクラッシュしない安全設計
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let clientInstance: SupabaseClient<Database> | null = null;

/**
 * Supabaseクライアントを取得するシングルトン関数
 * 環境変数が設定されていない場合は警告ログを出力し、ダミークライアントを返すかエラーを投げる
 */
export function getSupabase(): SupabaseClient<Database> {
  if (clientInstance) {
    return clientInstance;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'test' || typeof window === 'undefined') {
      // テストまたはSSR/ビルド時はフォールバッククライアントを生成してクラッシュを防ぐ
      clientInstance = createClient<Database>(
        supabaseUrl || 'https://placeholder.supabase.co',
        supabaseAnonKey || 'placeholder-anon-key'
      );
      return clientInstance;
    }

    throw new Error(
      'Supabase 環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。'
    );
  }

  clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'mahjong_app_auth_token',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return clientInstance;
}

/**
 * 簡易アクセスのためのデフォルトクライアント
 */
export const supabase = getSupabase();
