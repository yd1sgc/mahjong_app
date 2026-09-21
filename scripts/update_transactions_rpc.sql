-- ==============================================================================
-- Supabase RPC: ネイティブトランザクション完全配備（堅牢防壁版）
-- 1. create_game_transaction: games と game_participants を不可分登録
-- 2. commit_round_transaction: rounds, round_seats, yakuman_records を不可分登録
-- 3. settle_game_transaction: gamesステータスと参加者成績を不可分更新
-- 4. abort_game_transaction: gamesおよび連鎖データをCASCADE削除
-- 5. update_round_recalculate_transaction: 局修正時のrounds, round_seats, yakuman_records一括不可分更新
-- 6. undo_round_transaction: 前局取消時のrounds, yakuman_records不可分削除
-- ==============================================================================

-- 旧シグネチャ関数の削除（競合防止）
DROP FUNCTION IF EXISTS public.commit_round_transaction(TEXT, INTEGER, TEXT, INTEGER, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.commit_round_transaction(TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.create_game_transaction(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.abort_game_transaction(UUID);
DROP FUNCTION IF EXISTS public.settle_game_transaction(UUID, JSONB);

-- ------------------------------------------------------------------------------
-- 1. 新規対局作成トランザクション（完全防壁版）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_game_transaction(
    p_game_id TEXT,
    p_group_id TEXT,
    p_passcode TEXT,
    p_rule_name TEXT,
    p_rule_config JSONB,
    p_participants JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_part JSONB;
BEGIN
    -- 参加者は厳格に4名であることを保証
    IF p_participants IS NULL OR jsonb_array_length(p_participants) <> 4 THEN
        RAISE EXCEPTION '参加者データは厳格に4名分必要です (received: %)', COALESCE(jsonb_array_length(p_participants), 0);
    END IF;

    -- 1. games レコード作成
    INSERT INTO public.games (
        game_id,
        group_id,
        passcode,
        rule_name_snapshot,
        rule_config_snapshot,
        status,
        sync_target,
        is_synced
    ) VALUES (
        p_game_id,
        p_group_id,
        p_passcode,
        p_rule_name,
        p_rule_config,
        'in_progress',
        1,
        1
    );

    -- 2. game_participants 4席分の一括作成
    FOR v_part IN SELECT * FROM jsonb_array_elements(p_participants)
    LOOP
        INSERT INTO public.game_participants (
            game_id,
            seat,
            member_id,
            player_name_snapshot,
            final_score,
            rank,
            point,
            was_group_member
        ) VALUES (
            p_game_id,
            (v_part->>'seat')::INTEGER,
            v_part->>'member_id',
            COALESCE(v_part->>'player_name_snapshot', 'Player ' || (v_part->>'seat')),
            COALESCE(NULLIF(v_part->>'final_score', '')::INTEGER, 25000),
            COALESCE(NULLIF(v_part->>'rank', '')::INTEGER, (v_part->>'seat')::INTEGER),
            COALESCE(NULLIF(v_part->>'point', '')::NUMERIC(6,1), 0.0),
            COALESCE(NULLIF(v_part->>'was_group_member', '')::INTEGER, 1)
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'game_id', p_game_id);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'create_game_transaction failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. 局確定トランザクション（完全防壁版）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_round_transaction(
    p_round_id TEXT,
    p_game_id TEXT,
    p_round_index INTEGER,
    p_kyoku_name TEXT,
    p_honba INTEGER,
    p_riichi_sticks INTEGER,
    p_result_type TEXT,
    p_seats JSONB,
    p_yakumans JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seat JSONB;
    v_yakuman JSONB;
BEGIN
    -- 座席データは厳格に4席分であることを保証
    IF p_seats IS NULL OR jsonb_array_length(p_seats) <> 4 THEN
        RAISE EXCEPTION '座席データは厳格に4席分必要です (received: %)', COALESCE(jsonb_array_length(p_seats), 0);
    END IF;

    -- 1. rounds レコード作成（クライアント生成の round_id を厳格に使用）
    INSERT INTO public.rounds (
        round_id,
        game_id,
        round_index,
        kyoku_name,
        honba,
        riichi_sticks,
        result_type
    ) VALUES (
        p_round_id,
        p_game_id,
        p_round_index,
        p_kyoku_name,
        COALESCE(p_honba, 0),
        COALESCE(p_riichi_sticks, 0),
        p_result_type
    );

    -- 2. round_seats 一括作成（全整数カラムの安全キャスト）
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
            p_round_id,
            (v_seat->>'seat')::INTEGER,
            v_seat->>'member_id',
            COALESCE(NULLIF(v_seat->>'base_point', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'honba_point', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'kyotaku_point', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'penalty_point', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'score_delta', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'chip_delta', '')::INTEGER, 0),
            NULLIF(v_seat->>'han', '')::INTEGER,
            NULLIF(v_seat->>'fu', '')::INTEGER,
            COALESCE(NULLIF(v_seat->>'is_winner', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'is_loser', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'is_riichi', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'is_furo', '')::INTEGER, 0),
            COALESCE(NULLIF(v_seat->>'is_tenpai', '')::INTEGER, 0)
        );
    END LOOP;

    -- 3. yakuman_records 一括作成（役満が存在する場合のみ不可分に実行）
    IF p_yakumans IS NOT NULL AND jsonb_typeof(p_yakumans) = 'array' THEN
        FOR v_yakuman IN SELECT * FROM jsonb_array_elements(p_yakumans)
        LOOP
            INSERT INTO public.yakuman_records (
                game_id,
                round_id,
                member_id,
                yakuman_name
            ) VALUES (
                p_game_id,
                p_round_id,
                v_yakuman->>'member_id',
                v_yakuman->>'yakuman_name'
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'round_id', p_round_id);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'commit_round_transaction failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. 対局精算アトミックトランザクション（安全キャスト防壁版）
-- ------------------------------------------------------------------------------
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

    -- 2. 参加者スコア・順位・確定ポイントの不可分更新
    FOR v_st IN SELECT * FROM jsonb_array_elements(p_settlements)
    LOOP
        UPDATE public.game_participants
        SET
            final_score = COALESCE(NULLIF(v_st->>'final_score', '')::INTEGER, 25000),
            rank = COALESCE(NULLIF(v_st->>'rank', '')::INTEGER, 1),
            point = COALESCE(NULLIF(v_st->>'point', '')::NUMERIC(6,1), 0.0)
        WHERE game_id = p_game_id
          AND seat = (v_st->>'seat')::INTEGER;
    END LOOP;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'settle_game_transaction failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. 対局破棄アトミックトランザクション
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. 局修正アトミックトランザクション（新規配備）
-- rounds, round_seats の一括UPSERTおよび対象局の役満レコード洗替を1不可分トランザクションで実行
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_round_recalculate_transaction(
    p_game_id TEXT,
    p_target_round_id TEXT,
    p_rounds JSONB,
    p_seats JSONB,
    p_yakumans JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_round JSONB;
    v_seat JSONB;
    v_yakuman JSONB;
BEGIN
    -- 1. rounds レコード群の一括 UPSERT
    IF p_rounds IS NOT NULL AND jsonb_typeof(p_rounds) = 'array' THEN
        FOR v_round IN SELECT * FROM jsonb_array_elements(p_rounds)
        LOOP
            INSERT INTO public.rounds (
                round_id,
                game_id,
                round_index,
                kyoku_name,
                honba,
                riichi_sticks,
                result_type
            ) VALUES (
                v_round->>'round_id',
                p_game_id,
                (v_round->>'round_index')::INTEGER,
                v_round->>'kyoku_name',
                COALESCE(NULLIF(v_round->>'honba', '')::INTEGER, 0),
                COALESCE(NULLIF(v_round->>'riichi_sticks', '')::INTEGER, 0),
                v_round->>'result_type'
            )
            ON CONFLICT (round_id) DO UPDATE SET
                game_id = EXCLUDED.game_id,
                round_index = EXCLUDED.round_index,
                kyoku_name = EXCLUDED.kyoku_name,
                honba = EXCLUDED.honba,
                riichi_sticks = EXCLUDED.riichi_sticks,
                result_type = EXCLUDED.result_type;
        END LOOP;
    END IF;

    -- 2. round_seats レコード群の一括 UPSERT
    IF p_seats IS NOT NULL AND jsonb_typeof(p_seats) = 'array' THEN
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
                v_seat->>'round_id',
                (v_seat->>'seat')::INTEGER,
                v_seat->>'member_id',
                COALESCE(NULLIF(v_seat->>'base_point', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'honba_point', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'kyotaku_point', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'penalty_point', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'score_delta', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'chip_delta', '')::INTEGER, 0),
                NULLIF(v_seat->>'han', '')::INTEGER,
                NULLIF(v_seat->>'fu', '')::INTEGER,
                COALESCE(NULLIF(v_seat->>'is_winner', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'is_loser', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'is_riichi', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'is_furo', '')::INTEGER, 0),
                COALESCE(NULLIF(v_seat->>'is_tenpai', '')::INTEGER, 0)
            )
            ON CONFLICT (round_id, seat) DO UPDATE SET
                member_id = EXCLUDED.member_id,
                base_point = EXCLUDED.base_point,
                honba_point = EXCLUDED.honba_point,
                kyotaku_point = EXCLUDED.kyotaku_point,
                penalty_point = EXCLUDED.penalty_point,
                score_delta = EXCLUDED.score_delta,
                chip_delta = EXCLUDED.chip_delta,
                han = EXCLUDED.han,
                fu = EXCLUDED.fu,
                is_winner = EXCLUDED.is_winner,
                is_loser = EXCLUDED.is_loser,
                is_riichi = EXCLUDED.is_riichi,
                is_furo = EXCLUDED.is_furo,
                is_tenpai = EXCLUDED.is_tenpai;
        END LOOP;
    END IF;

    -- 3. 修正対象局の役満レコード洗替（既存削除 ＋ 新規挿入）
    IF p_target_round_id IS NOT NULL AND p_target_round_id <> '' THEN
        DELETE FROM public.yakuman_records WHERE round_id = p_target_round_id;

        IF p_yakumans IS NOT NULL AND jsonb_typeof(p_yakumans) = 'array' THEN
            FOR v_yakuman IN SELECT * FROM jsonb_array_elements(p_yakumans)
            LOOP
                INSERT INTO public.yakuman_records (
                    game_id,
                    round_id,
                    member_id,
                    yakuman_name
                ) VALUES (
                    p_game_id,
                    p_target_round_id,
                    v_yakuman->>'member_id',
                    v_yakuman->>'yakuman_name'
                );
            END LOOP;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'update_round_recalculate_transaction failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. 前局確定取消アトミックトランザクション（新規配備）
-- rounds レコードおよび関連役満レコードを安全に不可分削除
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.undo_round_transaction(
    p_game_id TEXT,
    p_round_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 役満レコード明示的削除（外部キーCASCADE未定義環境への安全弁）
    DELETE FROM public.yakuman_records 
    WHERE round_id = p_round_id;

    -- rounds レコード削除（round_seats はCASCADEにより連鎖削除）
    DELETE FROM public.rounds 
    WHERE round_id = p_round_id 
      AND game_id = p_game_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'undo_round_transaction failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. 実行権限の付与
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_game_transaction(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_round_transaction(TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, TEXT, JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_game_transaction(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_game_transaction(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_round_recalculate_transaction(TEXT, TEXT, JSONB, JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_round_transaction(TEXT, TEXT) TO anon, authenticated;
