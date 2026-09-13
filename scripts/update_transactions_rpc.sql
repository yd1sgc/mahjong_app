-- ==============================================================================
-- Supabase RPC: アトミックトランザクション関数（P2課題対応）
-- 局確定（commit_round_transaction）、精算（settle_game_transaction）、破棄（abort_game_transaction）
-- 分割INSERTによるデータ破損を防止し、PostgreSQL側で完全アトミック実行
-- ==============================================================================

-- 1. 局確定アトミックトランザクション
CREATE OR REPLACE FUNCTION public.commit_round_transaction(
    p_game_id TEXT,
    p_round_index INTEGER,
    p_kyoku_name TEXT,
    p_honba INTEGER,
    p_riichi_sticks INTEGER,
    p_result_type TEXT,
    p_seats JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_round_id TEXT;
    v_seat JSONB;
BEGIN
    -- 1. round_id の生成
    v_round_id := gen_random_uuid()::TEXT;

    -- 2. rounds レコード作成
    INSERT INTO public.rounds (
        round_id,
        game_id,
        round_index,
        kyoku_name,
        honba,
        riichi_sticks,
        result_type
    ) VALUES (
        v_round_id,
        p_game_id,
        p_round_index,
        p_kyoku_name,
        p_honba,
        p_riichi_sticks,
        p_result_type
    );

    -- 3. round_seats 一括作成（座席ごとの点数変動・役情報）
    FOR v_seat IN SELECT * FROM jsonb_array_elements(p_seats)
    LOOP
        INSERT INTO public.round_seats (
            round_id,
            seat,
            member_id,
            base_point,
            honba_point,
            kyotaku_point,
            penalty_point,
            score_delta,
            chip_delta,
            han,
            fu,
            is_winner,
            is_loser,
            is_riichi,
            is_furo,
            is_tenpai
        ) VALUES (
            v_round_id,
            (v_seat->>'seat')::INTEGER,
            v_seat->>'member_id',
            COALESCE((v_seat->>'base_point')::INTEGER, 0),
            COALESCE((v_seat->>'honba_point')::INTEGER, 0),
            COALESCE((v_seat->>'kyotaku_point')::INTEGER, 0),
            COALESCE((v_seat->>'penalty_point')::INTEGER, 0),
            COALESCE((v_seat->>'score_delta')::INTEGER, 0),
            COALESCE((v_seat->>'chip_delta')::INTEGER, 0),
            (v_seat->>'han')::INTEGER,
            (v_seat->>'fu')::INTEGER,
            COALESCE((v_seat->>'is_winner')::INTEGER, 0),
            COALESCE((v_seat->>'is_loser')::INTEGER, 0),
            COALESCE((v_seat->>'is_riichi')::INTEGER, 0),
            COALESCE((v_seat->>'is_furo')::INTEGER, 0),
            COALESCE((v_seat->>'is_tenpai')::INTEGER, 0)
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'round_id', v_round_id);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'commit_round_transaction failed: %', SQLERRM;
END;
$$;

-- 2. 対局精算アトミックトランザクション
CREATE OR REPLACE FUNCTION public.settle_game_transaction(
    p_game_id TEXT,
    p_settlements JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_st JSONB;
BEGIN
    -- 1. games テーブルの status を 'completed' に更新
    UPDATE public.games
    SET status = 'completed'
    WHERE game_id = p_game_id;

    -- 2. 参加者スコア・順位・確定ポイントの更新
    FOR v_st IN SELECT * FROM jsonb_array_elements(p_settlements)
    LOOP
        UPDATE public.game_participants
        SET
            final_score = (v_st->>'final_score')::INTEGER,
            rank = (v_st->>'rank')::INTEGER,
            point = (v_st->>'point')::NUMERIC(6,1)
        WHERE game_id = p_game_id
          AND seat = (v_st->>'seat')::INTEGER;
    END LOOP;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'settle_game_transaction failed: %', SQLERRM;
END;
$$;

-- 3. 対局破棄アトミックトランザクション
CREATE OR REPLACE FUNCTION public.abort_game_transaction(
    p_game_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- CASCADEにより関連データ（rounds, round_seats, game_participants）も連鎖削除
    DELETE FROM public.games WHERE game_id = p_game_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'abort_game_transaction failed: %', SQLERRM;
END;
$$;

-- 4. 実行権限の付与
GRANT EXECUTE ON FUNCTION public.commit_round_transaction(TEXT, INTEGER, TEXT, INTEGER, INTEGER, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_game_transaction(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_game_transaction(TEXT) TO anon, authenticated;
