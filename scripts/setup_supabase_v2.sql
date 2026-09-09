-- ==============================================================================
-- Supabase (PostgreSQL) V2 Normalized Schema Setup Script
-- docs/DETAILED_DESIGN.md 準拠（完全無料枠・静的SPA・4桁PIN対応）
-- ==============================================================================

BEGIN;

-- 1. スキーマバージョンメタテーブル
CREATE TABLE IF NOT EXISTS public.schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.schema_meta (key, value)
VALUES ('schema_version', '2.0.0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 2. 既存の旧テーブル退避（存在する場合）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'game_participants' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_participants_v1_backup')) THEN
        ALTER TABLE public.game_participants RENAME TO game_participants_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'round_seats' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'round_seats_v1_backup')) THEN
        ALTER TABLE public.round_seats RENAME TO round_seats_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rounds' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rounds_v1_backup')) THEN
        ALTER TABLE public.rounds RENAME TO rounds_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games_v1_backup')) THEN
        ALTER TABLE public.games RENAME TO games_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_memberships' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_memberships_v1_backup')) THEN
        ALTER TABLE public.group_memberships RENAME TO group_memberships_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members_v1_backup')) THEN
        ALTER TABLE public.members RENAME TO members_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'groups_v1_backup')) THEN
        ALTER TABLE public.groups RENAME TO groups_v1_backup;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rule_templates' AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rule_templates_v1_backup')) THEN
        ALTER TABLE public.rule_templates RENAME TO rule_templates_v1_backup;
    END IF;
END $$;

-- 3. マスタテーブル群（V2 新規作成）
CREATE TABLE IF NOT EXISTS public.members (
    member_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    member_name TEXT NOT NULL,
    is_guest INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups (
    group_id TEXT PRIMARY KEY,
    display_id TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    default_rule_id TEXT NOT NULL,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_memberships (
    group_id TEXT NOT NULL REFERENCES public.groups(group_id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.rule_templates (
    rule_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL, -- 'official' | 'custom'
    version INTEGER NOT NULL DEFAULT 1,
    config_json JSONB NOT NULL,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 対局・成績テーブル群（完全縦持ち）
CREATE TABLE IF NOT EXISTS public.games (
    game_id TEXT PRIMARY KEY,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    group_id TEXT NOT NULL REFERENCES public.groups(group_id),
    recorder_id UUID REFERENCES auth.users(id),
    passcode TEXT NOT NULL DEFAULT '0000', -- 4桁PIN（引き継ぎ用）
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'finished'
    rule_name_snapshot TEXT NOT NULL,
    rule_config_snapshot JSONB NOT NULL,
    game_mode TEXT NOT NULL DEFAULT 'detail',
    sync_target INTEGER NOT NULL DEFAULT 1,
    is_synced INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_participants (
    game_id TEXT NOT NULL REFERENCES public.games(game_id) ON DELETE CASCADE,
    seat INTEGER NOT NULL CHECK (seat BETWEEN 1 AND 4),
    member_id TEXT NOT NULL REFERENCES public.members(member_id),
    player_name_snapshot TEXT NOT NULL,
    final_score INTEGER NOT NULL,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 4),
    point NUMERIC(6,1) NOT NULL,
    was_group_member INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (game_id, seat)
);

CREATE TABLE IF NOT EXISTS public.rounds (
    round_id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES public.games(game_id) ON DELETE CASCADE,
    round_index INTEGER NOT NULL,
    kyoku_name TEXT NOT NULL,
    honba INTEGER NOT NULL DEFAULT 0,
    riichi_sticks INTEGER NOT NULL DEFAULT 0,
    result_type TEXT NOT NULL, -- 'ron' | 'tsumo' | 'ryukyoku' | 'chombo' | 'multi_ron' | 'mid_ryukyoku'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.round_seats (
    round_id TEXT NOT NULL REFERENCES public.rounds(round_id) ON DELETE CASCADE,
    seat INTEGER NOT NULL CHECK (seat BETWEEN 1 AND 4),
    member_id TEXT NOT NULL REFERENCES public.members(member_id),
    base_point INTEGER NOT NULL DEFAULT 0,
    honba_point INTEGER NOT NULL DEFAULT 0,
    kyotaku_point INTEGER NOT NULL DEFAULT 0,
    penalty_point INTEGER NOT NULL DEFAULT 0,
    score_delta INTEGER NOT NULL DEFAULT 0,
    chip_delta INTEGER NOT NULL DEFAULT 0,
    han INTEGER,
    fu INTEGER,
    is_winner INTEGER NOT NULL DEFAULT 0,
    is_loser INTEGER NOT NULL DEFAULT 0,
    is_riichi INTEGER NOT NULL DEFAULT 0,
    is_furo INTEGER NOT NULL DEFAULT 0,
    is_tenpai INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (round_id, seat)
);

CREATE TABLE IF NOT EXISTS public.drafts (
    id TEXT PRIMARY KEY,
    state_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. パフォーマンスインデックス
CREATE INDEX IF NOT EXISTS idx_games_played_at ON public.games(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_group ON public.games(group_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_member ON public.game_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_rank ON public.game_participants(rank);
CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON public.rounds(game_id, round_index);
CREATE INDEX IF NOT EXISTS idx_round_seats_member ON public.round_seats(member_id);

-- 6. 公式ルールプリセット
INSERT INTO public.rule_templates (rule_id, name, kind, version, config_json, is_archived)
VALUES 
(
    'preset_m_league', 'Mリーグルール', 'official', 1,
    '{"basic": {"init_score": 25000, "return_score": 30000, "uma": [30, 10, -10, -30], "rounding_type": "四捨五入"}, "detail": {"tobi_end": "none", "agari_yame": "none", "honba_pt": 300, "riichi_pt": 1000, "game_length": "hanchan"}}'::jsonb,
    0
),
(
    'preset_standard', '一般アリアリ（ゴットー）', 'official', 1,
    '{"basic": {"init_score": 25000, "return_score": 30000, "uma": [10, 5, -5, -10], "rounding_type": "五捨六入"}, "detail": {"tobi_end": "under_zero", "agari_yame": "top_only", "honba_pt": 300, "riichi_pt": 1000, "game_length": "hanchan"}}'::jsonb,
    0
),
(
    'preset_saikouisen', '最高位戦日本プロ麻雀協会', 'official', 1,
    '{"basic": {"init_score": 30000, "return_score": 30000, "uma": [30, 10, -10, -30], "rounding_type": "四捨五入"}, "detail": {"tobi_end": "none", "agari_yame": "none", "honba_pt": 300, "riichi_pt": 1000, "game_length": "hanchan"}}'::jsonb,
    0
)
ON CONFLICT (rule_id) DO NOTHING;

-- 7. 4桁PINによる記録係交代ストアドプロシージャ (RPC)
CREATE OR REPLACE FUNCTION public.transfer_recorder(p_game_id TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_correct_pin TEXT;
BEGIN
    SELECT passcode INTO v_correct_pin FROM public.games WHERE game_id = p_game_id;
    IF v_correct_pin IS NULL OR v_correct_pin != p_pin THEN
        RAISE EXCEPTION '無効な対局PINコードです';
    END IF;
    
    UPDATE public.games 
    SET recorder_id = auth.uid() 
    WHERE game_id = p_game_id;
    
    RETURN TRUE;
END;
$$;

-- 8. ロール権限の付与（anon / authenticated がアクセス可能にする）
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 今後作成されるテーブルへの自動権限付与
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- 9. Row Level Security (RLS) 設定
-- 既存データを自由に行き来できるように閲覧・操作を解放（必要に応じてポリシー制限）
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- 全開放ポリシー（anon / authenticated 双方に SELECT/INSERT/UPDATE/DELETE を許可）
DROP POLICY IF EXISTS "anon_all_members" ON public.members;
CREATE POLICY "anon_all_members" ON public.members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_groups" ON public.groups;
CREATE POLICY "anon_all_groups" ON public.groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_group_memberships" ON public.group_memberships;
CREATE POLICY "anon_all_group_memberships" ON public.group_memberships FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_rule_templates" ON public.rule_templates;
CREATE POLICY "anon_all_rule_templates" ON public.rule_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_games" ON public.games;
CREATE POLICY "anon_all_games" ON public.games FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_game_participants" ON public.game_participants;
CREATE POLICY "anon_all_game_participants" ON public.game_participants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_rounds" ON public.rounds;
CREATE POLICY "anon_all_rounds" ON public.rounds FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_round_seats" ON public.round_seats;
CREATE POLICY "anon_all_round_seats" ON public.round_seats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_drafts" ON public.drafts;
CREATE POLICY "anon_all_drafts" ON public.drafts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

COMMIT;
