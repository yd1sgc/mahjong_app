/**
 * Supabase PostgreSQL V2 スキーマ完全準拠の型定義
 * docs/DETAILED_DESIGN.md 第7項に準拠
 * 
 * 最新 @supabase/supabase-js 型定義要件（GenericTable: Relationships 配列必須）準拠
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          member_id: string; // UUID
          user_id: string | null; // auth.users.id
          member_name: string;
          is_guest: number; // 0 | 1
          is_archived: number; // 0 | 1
          created_at: string; // TIMESTAMPTZ
        };
        Insert: {
          member_id: string;
          user_id?: string | null;
          member_name: string;
          is_guest?: number;
          is_archived?: number;
          created_at?: string;
        };
        Update: {
          member_id?: string;
          user_id?: string | null;
          member_name?: string;
          is_guest?: number;
          is_archived?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          group_id: string; // UUID
          display_id: string;
          group_name: string;
          default_rule_id: string;
          is_archived: number; // 0 | 1
          created_at: string;
        };
        Insert: {
          group_id: string;
          display_id: string;
          group_name: string;
          default_rule_id: string;
          is_archived?: number;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          display_id?: string;
          group_name?: string;
          default_rule_id?: string;
          is_archived?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      group_memberships: {
        Row: {
          group_id: string; // UUID
          member_id: string; // UUID
        };
        Insert: {
          group_id: string;
          member_id: string;
        };
        Update: {
          group_id?: string;
          member_id?: string;
        };
        Relationships: [];
      };
      rule_templates: {
        Row: {
          rule_id: string;
          name: string;
          kind: 'official' | 'custom' | string;
          version: number;
          config_json: Json;
          is_archived: number; // 0 | 1
          created_at: string;
        };
        Insert: {
          rule_id: string;
          name: string;
          kind?: 'official' | 'custom' | string;
          version?: number;
          config_json: Json;
          is_archived?: number;
          created_at?: string;
        };
        Update: {
          rule_id?: string;
          name?: string;
          kind?: 'official' | 'custom' | string;
          version?: number;
          config_json?: Json;
          is_archived?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          game_id: string; // UUID
          played_at: string;
          group_id: string; // UUID
          recorder_id: string | null; // auth.users.id
          passcode: string; // 4桁PIN
          status: 'in_progress' | 'finished' | string;
          rule_name_snapshot: string;
          rule_config_snapshot: Json;
          game_mode: 'detail' | 'simple' | string;
          sync_target: number; // 0 | 1
          is_synced: number; // 0 | 1
          created_at: string;
        };
        Insert: {
          game_id: string;
          played_at?: string;
          group_id: string;
          recorder_id?: string | null;
          passcode: string;
          status?: 'in_progress' | 'finished' | string;
          rule_name_snapshot: string;
          rule_config_snapshot: Json;
          game_mode?: 'detail' | 'simple' | string;
          sync_target?: number;
          is_synced?: number;
          created_at?: string;
        };
        Update: {
          game_id?: string;
          played_at?: string;
          group_id?: string;
          recorder_id?: string | null;
          passcode?: string;
          status?: 'in_progress' | 'finished' | string;
          rule_name_snapshot?: string;
          rule_config_snapshot?: Json;
          game_mode?: 'detail' | 'simple' | string;
          sync_target?: number;
          is_synced?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      game_participants: {
        Row: {
          game_id: string; // UUID
          seat: number; // 1..4
          member_id: string; // UUID
          player_name_snapshot: string;
          final_score: number;
          rank: number; // 1..4
          point: number; // numeric(6,1)
          was_group_member: number; // 0 | 1
        };
        Insert: {
          game_id: string;
          seat: number;
          member_id: string;
          player_name_snapshot: string;
          final_score: number;
          rank: number;
          point: number;
          was_group_member?: number;
        };
        Update: {
          game_id?: string;
          seat?: number;
          member_id?: string;
          player_name_snapshot?: string;
          final_score?: number;
          rank?: number;
          point?: number;
          was_group_member?: number;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          round_id: string; // UUID
          game_id: string; // UUID
          round_index: number;
          kyoku_name: string;
          honba: number;
          riichi_sticks: number;
          result_type: 'ron' | 'tsumo' | 'ryukyoku' | 'chombo' | 'multi_ron' | 'mid_ryukyoku' | string;
          created_at: string;
        };
        Insert: {
          round_id: string;
          game_id: string;
          round_index: number;
          kyoku_name: string;
          honba?: number;
          riichi_sticks?: number;
          result_type: 'ron' | 'tsumo' | 'ryukyoku' | 'chombo' | 'multi_ron' | 'mid_ryukyoku' | string;
          created_at?: string;
        };
        Update: {
          round_id?: string;
          game_id?: string;
          round_index?: number;
          kyoku_name?: string;
          honba?: number;
          riichi_sticks?: number;
          result_type?: 'ron' | 'tsumo' | 'ryukyoku' | 'chombo' | 'multi_ron' | 'mid_ryukyoku' | string;
          created_at?: string;
        };
        Relationships: [];
      };
      round_seats: {
        Row: {
          round_id: string; // UUID
          seat: number; // 1..4
          member_id: string; // UUID
          base_point: number;
          honba_point: number;
          kyotaku_point: number;
          penalty_point: number;
          score_delta: number;
          chip_delta: number;
          han: number | null;
          fu: number | null;
          is_winner: number; // 0 | 1
          is_loser: number; // 0 | 1
          is_riichi: number; // 0 | 1
          is_furo: number; // 0 | 1
          is_tenpai: number; // 0 | 1
        };
        Insert: {
          round_id: string;
          seat: number;
          member_id: string;
          base_point?: number;
          honba_point?: number;
          kyotaku_point?: number;
          penalty_point?: number;
          score_delta?: number;
          chip_delta?: number;
          han?: number | null;
          fu?: number | null;
          is_winner?: number;
          is_loser?: number;
          is_riichi?: number;
          is_furo?: number;
          is_tenpai?: number;
        };
        Update: {
          round_id?: string;
          seat?: number;
          member_id?: string;
          base_point?: number;
          honba_point?: number;
          kyotaku_point?: number;
          penalty_point?: number;
          score_delta?: number;
          chip_delta?: number;
          han?: number | null;
          fu?: number | null;
          is_winner?: number;
          is_loser?: number;
          is_riichi?: number;
          is_furo?: number;
          is_tenpai?: number;
        };
        Relationships: [];
      };
      drafts: {
        Row: {
          id: string;
          state_json: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          state_json: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          state_json?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      transfer_recorder: {
        Args: {
          p_game_id: string;
          p_pin: string;
        };
        Returns: boolean;
      };
      commit_round_transaction: {
        Args: {
          p_game_id: string;
          p_round_index: number;
          p_kyoku_name: string;
          p_honba: number;
          p_riichi_sticks: number;
          p_result_type: string;
          p_seats: Json;
        };
        Returns: Json;
      };
      settle_game_transaction: {
        Args: {
          p_game_id: string;
          p_settlements: Json;
        };
        Returns: Json;
      };
      abort_game_transaction: {
        Args: {
          p_game_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/** 簡易エイリアス型定義 */
export type MemberRow = Database['public']['Tables']['members']['Row'];
export type GroupRow = Database['public']['Tables']['groups']['Row'];
export type RuleTemplateRow = Database['public']['Tables']['rule_templates']['Row'];
export type GameRow = Database['public']['Tables']['games']['Row'];
export type GameParticipantRow = Database['public']['Tables']['game_participants']['Row'];
export type RoundRow = Database['public']['Tables']['rounds']['Row'];
export type RoundSeatRow = Database['public']['Tables']['round_seats']['Row'];
export type RoundSeatInsert = Database['public']['Tables']['round_seats']['Insert'];
export type RoundInsert = Database['public']['Tables']['rounds']['Insert'];
