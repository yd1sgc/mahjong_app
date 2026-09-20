# Project Changelog & Completed Implementation Archive

本ドキュメントは、過去の開発フェーズ（Phase 1 〜 Phase 5-I）における詳細な実装・改修履歴を保管するアーカイブです。
通常のセッション開始時に読み込む必要はありません。過去の設計意図や改修経緯を詳しく調査する必要がある場合のみ参照してください。

---

## Phase 1 完了（麻雀純粋ドメインロジック構築 & Vitestテスト全41件PASS）
- `src/types/mahjong.ts`（純粋型定義）
- `src/lib/mahjong/calc.ts`（翻・符計算、ウマオカ、オカなし）
- `src/lib/mahjong/rules.ts`（局進行、連荘、ノーテン罰符、チョンボ、ダブロン、トビ・サドンデス判定）
- `src/lib/mahjong/index.ts`（公開エントリポイント）
- `tests/calc.test.ts`, `tests/rules.test.ts`（単体テスト全41件 ALL PASS）

## Phase 2 完了（Supabaseクライアント & V2型定義配備 & 突合検証完了）
- `src/types/database.ts`（全8テーブル + RPC型定義）
- `src/lib/supabase.ts`（静的SPA/テストセーフなクライアント初期化）
- `.env.example`（接続設定テンプレート配備）
- `next build`（静的SPA HTML出力確認完了）
- **クラウドデータ移行・突合検証 100% PASS:**
  - PCローカルDB（`local_mahjong_v2_new.db`）のオンライン同期対象（`sync_target = 1`）27対局（300局・参加者108名）を新Supabase（`bhwbqxftifxxfmwinchx`）へ一括インポート。
  - 27対局の総素点（2,700,000点）、総ポイント（0.0pt）、全13名のプレイヤー別対局数・合計pt・素点合計がSQLiteとSupabase間で1pt・0.1%の狂いもなく完全一致することを確認済み。

## Phase 3 完了（Web対局コア画面 & 状態管理フック構築）
- `src/hooks/useGame.ts`（LocalStorage下書き復元、対局状態管理、Realtime自動購読、4桁PIN引き継ぎ、0ms楽観的更新）
- `src/components/ScoreBoard.tsx`（4名スコアボード、親マーク、点差、本場、供託）
- `src/components/ActionPanel.tsx`（記録係専用操作ボタン、閲覧モード表示、PIN交代導線）
- `src/components/RoundInputModal.tsx`（和了・流局入力モーダル、即時下書き保存、二重送信防止）
- `src/components/PinTransferModal.tsx`（4桁PIN入力モーダル）
- `src/app/game/page.tsx`（静的SPA完全対応の1画面スクロールレス対局画面）
- `src/app/page.tsx`（対局一覧＆新規対局開始モーダル）
- `next build`（静的SPA `/game.html`, `/index.html` 出力確認完了）

## Phase 3.5 完了（フロントエンドUI/UX再設計: mahjong_personal準拠 & 絵文字完全排除 & PC/スマホ両立）
- **対局画面（`/game`）**: 2x2グリッドを廃止し、縦4行リスト（名前・持ち点: 4, 副: 1, 立: 1）へ刷新。タップによる相対点差表示トグル（青: プラス、赤: マイナス）、副露ボタン（トグル・LocalStorage保存・立直と相互排他制御）、100dvh完全スクロールレス化。
- **和了入力モーダル（`RoundInputModal.tsx`）**: ステップ式ウィザード（誰が和了 → ロン/ツモ → 主要打点プリセット/翻符計算 → 放銃者 → 最終確認コミット）へ全面改修。
- **アクションパネル（`ActionPanel.tsx`）**: メインアクションを「和了」「流局」の2大ボタンに整理し、スマホでのタップ領域を最大化。
- **ホーム画面（`/`）**: 進行中の対局がある場合の自動検知再開バナー新設、巨大な「対局を始める」大ボタン配置、目的別導線の明確化。
- **成績集計画面（`/stats`）**: 通算pt、平均順位、対局数、1〜4位分布バー、和了率、放銃率、立直率、平均素点、ラス回避率の指標グリッド整理。
- **統合管理画面（`/manage`）**: グループ管理、ルール管理（ウマオカ・連荘・飛び賞等の設定カード）、クラウド同期ステータス画面を新設。
- **デザイン規律**: 絵文字の完全排除、太字・大文字・高コントラスト・PC中央配置（`max-w-xl`）の統一。
- `next build` による全静的ルート（`/`, `/game`, `/manage`, `/stats`）の正常出力確認完了。

## Phase 3.6 完了（P0課題解消: 終局確定精算サイクル & 局確定データ不整合修正 & 対局破棄機能）
- **純粋精算ドメイン関数（`src/lib/mahjong/rules.ts`）**:
  - `calculateGameSettlement` を新設。供託リーチ棒のトップ加算、同点時の起家（東家→南家→西家→北家）優先順位判定、`calcPoint` によるウマオカ計算、端数ゼロサム調整（4名の合計が厳密に 0.0pt になることを保証）。
  - `tests/rules.test.ts` にテストを追加し、Vitest全44件 ALL PASS。
- **局コミットデータ完全化（`src/hooks/useGame.ts`）**:
  - `round_seats` の `member_id` に正規のUUIDを紐付け。
  - `score_delta`（前局からの差分）、`honba_point`、`kyotaku_point`、`base_point` を純粋関数に基づき正確に格納。
  - `is_furo` を画面の副露状態から `round_seats` へ永続化（副露率集計の正常化）。
- **対局終了・精算 & 破棄アクション新設（`useGame.ts`, `src/app/game/page.tsx`）**:
  - `finishGame`: `games.status = 'completed'` への更新および `game_participants`（4名）の `final_score`, `rank`, `point` 確定保存。
  - `abortGame`: 誤作成・テスト対局をDB（CASCADE完全削除）およびLocalStorageから消去する破棄機能。
  - ヘッダー右上への `[精算・終了]` ボタン配備（記録係のみ）、終局バナーからの導線新設。
  - 「対局終了・精算確認モーダル」新設（1〜4位プレビュー、確定保存、対局へ戻る、完全削除）。
  - 完了後の対局画面における結果サマリー・成績集計導線表示。
- `next build` による全静的ルートの正常出力確認完了。

## Phase 3.7 完了（P1課題解消: コード肥大化解消 & モジュール分割リファクタリング）
- **`src/components/RoundInputModal.tsx`（621行）の定数分離**:
  - 点数プリセット配列群を `src/lib/mahjong/presets.ts` に外出しし、静的データとUIロジックを分離。
- **`src/app/stats/page.tsx`（1,580行）の構造的分割（1,580行 -> 330行へ圧縮）**:
  - `src/lib/mahjong/statsCalc.ts`: 試合成績、局詳細、推移グラフ、レコード、相性マトリクスの集計ロジックを純粋関数層へ抽出。
  - `src/components/stats/ScoreTrendChart.tsx`: 手書きSVG推移グラフ描画コンポーネント。
  - `src/components/stats/CompatibilityMatrix.tsx`: 相性マトリクス（直接対決pt差）テーブル。
  - `src/components/stats/GameFilterAccordion.tsx`: 試合ID詳細フィルター（クイック選択・個別選択）。
  - `src/components/stats/GameDetailModal.tsx`: 対局詳細ポップアップモーダル。
  - `src/components/stats/StatsRecords.tsx`: 最高/最低スコアTop5、連勝記録コンポーネント。
  - `src/components/stats/StatsDetailsTab.tsx`: 詳細5タブ（基本・打点・守備・立直・副露）テーブル。
  - `src/components/stats/GameStatsTable.tsx`: メイン試合成績一覧テーブル。
- `npx vitest run`: 全44件 PASS。
- `next build`: 全静的ルート正常出力確認完了。

## Phase 4 完了（クラウド運用自動化 & デプロイ配備完了）
- **GitHub Actions Supabaseスリープ防止cron配備（`.github/workflows/supabase_keepalive.yml`）**:
  - 毎日JST午前0時（UTC 15:00）に定期実行され、無料枠プロジェクトの7日間非アクティブによる一時停止（ポーズ）を自動防止。
- **Cloudflare Workers Static Assets 本番デプロイ完了**:
  - `wrangler.jsonc`: 静的配信ディレクトリ `./out` を指定して設定。
  - GitHub連携による自動CI/CDパイプライン稼働確認済み（`main` ブランチプッシュで自動更新）。
  - **本番環境URL (Production)**: `https://mahjong-app.yd1sgc.workers.dev`
  - 環境変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `npx vitest run`: 全44件 ALL PASS。

## Phase 5-A 完了（クラウド運用自動化 & PostgreSQL RPCアトミックトランザクション配備）
- **GitHub Secrets設定完了**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 登録完了（毎日午前0時のスリープ防止ワークフロー有効化）。
- **Supabase RPC配備完了**:
  - `commit_round_transaction`: 局情報と4席データの不可分コミット（データ不整合リスク完全排除）。
  - `settle_game_transaction`: 終局精算とステータス更新の不可分コミット。
  - `abort_game_transaction`: 対局完全CASCADE削除。

## Phase 5-B 完了（useGame.ts 責務分割 & as any 排除 & 型厳格化）
- **`useGame.ts`（652行）を3つの責務別サブフックへ分割し、約100行のクリーンなファサードへ圧縮**:
  - `src/hooks/useGameDraft.ts`: LocalStorage下書き同期、副露トグル、記録係PIN管理。
  - `src/hooks/useGameData.ts`: Supabaseデータ取得、Realtime監視、純粋ドメイン再計算、画面復帰（`visibilitychange`）時の自動再同期。
  - `src/hooks/useGameActions.ts`: 局コミット・精算・破棄（Supabase RPC優先 ＋ フォールバック）、Undo、リーチ宣言。
- **型安全性向上**:
  - `src/types/database.ts`: 最新 `@supabase/supabase-js` 要件に合わせ、全テーブルに `Relationships: []` を配備。RPC関数型定義（`commit_round_transaction`, `settle_game_transaction`, `abort_game_transaction`）を追加。
  - `useGameActions.ts`, `useGameData.ts` 内の `as any` を全廃し、厳格な `Json` / `RoundSeatInsert` 等を適用。
- `npx vitest run`: 全44件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `next build`: 全静的ルート正常出力確認完了。

## Phase 5-C 完了（管理画面CRUD完全配備 & 目的別専用ページ分割）
- **無理なタブ統合を廃止し、独立した専用ページへ分割（スマホ操作性・認知的負荷の改善）**:
  - `src/app/page.tsx`: ホーム画面の導線を `/manage/rules`、`/manage/groups`（「グループ・メンバー」表記）、`/manage/system` へ最適化。
  - `src/app/manage/groups/page.tsx`: メンバー新規追加モーダル（名前重複バリデーション、ゲストフラグ）、メンバー名変更、論理アーカイブ（`is_archived = 1`）および復元アコーディオン、新規グループ作成（初期ルール指定）。
  - `src/app/manage/rules/page.tsx`: 公式ルール保護、公式ルールを複製して新規作成モーダル（配給原点、返し点、ウマ4席、連荘条件、飛び賞、サドンデス西入等のカスタム設定）、カスタムルールのアーカイブ・復元。
  - `src/app/manage/system/page.tsx`: クラウド同期状況、総対局数、総局数、登録メンバー数の統計表示。
  - `src/app/manage/page.tsx`: `/manage/groups` への即時リダイレクト処理。
- `npx vitest run`: 全44件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `next build`: 全静的ルート正常出力確認完了。

## Phase 5-E 完了（P3課題解消: トースト通知導入 & RoundInputModalステップ分割）
- **トースト通知システム（`src/components/Toast.tsx`）新設**:
  - 局確定成功（緑）「局結果を記録しました」、終局確定（緑）「対局を精算・確定しました」、巻き戻し（灰）「直前の局を巻き戻しました」。
  - 通信エラー時（赤）は画面下部にエラー表示 ＋ 「再試行」ボタンを配置し、電波断からのリカバリ導線を確立。
- **`RoundInputModal.tsx`（556行）のステップコンポーネント分割**:
  - `src/components/round-input/WinnerStep.tsx`: 和了者選択。
  - `src/components/round-input/WinTypeStep.tsx`: ロン / ツモ 方式選択。
  - `src/components/round-input/ScoreStep.tsx`: 主要打点プリセットグリッド ＋ 翻符手動計算。
  - `src/components/round-input/LoserStep.tsx`: 放銃者選択。
  - `src/components/round-input/ConfirmStep.tsx`: 最終収支確認 ＆ 確定コミット。
  - `src/components/round-input/RyukyokuStep.tsx`: 流局テンパイ選択 ＆ チョンボ入力。
  - `RoundInputModal.tsx` 本体を約230行へ半減し、状態管理とUI表示を疎結合化。
- `npx vitest run`: 全44件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `next build`: 全静的ルート正常出力確認完了。

## Phase 5-F 完了（過去対局ステータス正常化 & モバイルレイアウトシフト解消/Viewport設定）
- **過去対局ステータス一括正常化（Supabaseデータ修正）**:
  - PCローカルDB移行時に未設定で `'in_progress'` のまま保存されていた過去対局全27件の `status` を `'completed'` へ一括更新。
  - ホーム画面（`/`）で不要な「進行中の対局があります。再開しますか？」バナーが常時表示される不具合を完全解消。
- **モバイルレイアウトシフト・ビューポート設定（`src/app/layout.tsx`）**:
  - Next.js標準の `viewport: Viewport`（`width: "device-width", initialScale: 1`）を定義。
  - モバイルブラウザでの画面遷移時やボタンタップ時に一瞬縮小描画（980px）されてから広がる現象を抑止。
- `npx vitest run`: 全44件 ALL PASS。
- `next build`: 全11ルート正常出力確認完了。

## Phase 5-G 完了（全画面 w-full 適用 & モバイル左右余白・バランス調整）
- **全画面コンテナ横幅100%化（`w-full` 統一適用）**:
  - `src/app/page.tsx`, `src/app/game/page.tsx`, `src/app/stats/page.tsx`, `src/app/manage/groups/page.tsx`, `src/app/manage/rules/page.tsx`, `src/app/manage/system/page.tsx`, `src/app/aggregate/page.tsx` の全画面 `<main>` タグに `w-full` を付与。
  - iOS Safari（WebKit）環境で、Flexbox直下要素の横幅が縮んで左右に黒い余白が生じる現象を根本解消。
- **ホーム画面レイアウトのバランス最適化**:
  - 余計な要素を追加せずシンプルさを維持したまま、パディング（`px-4 py-6`）および間隔（`gap-6`）を整え、スマホ画面幅いっぱいに自然にフィットするよう調整。
- `npx vitest run`: 全44件 ALL PASS。
- `next build`: 全11ルート正常出力確認完了。

## Phase 5-H 完了（成績画面フィルター正常化 & ゲスト表示切り替え配備 & 供託収支復元 & ＋符号排除）
- **ルール名・ID完全正規化 & グループデフォルト連動（`src/app/stats/page.tsx`）**:
  - DBのV2スキーマ仕様に準拠し、架空の `rule_id` 参照を廃止。対局データの `rule_name_snapshot` がルールIDであっても正規表示名（日本語名）へ自動マッピング。
  - セレクト選択肢からID文字列を排除し、正規表示名のみを表示・直接照合。
  - グループ選択時、そのグループの `default_rule_id` に対応するルール名を特定し、ルール選択ボックスを自動連動更新する機能を配備。
- **ゲスト表示切り替え（ON/OFF）の実装**:
  - `members` の `is_guest === 1` を基にゲストプレイヤーを判定。
  - 「ゲストも表示する」チェックOFF時、試合成績、詳細成績5タブ、推移グラフ・選択肢、最高・最低・連勝レコード、相性マトリクスからゲストを完全に除外。
- **供託収支・打点・放銃点集計の正本SQL仕様完全準拠（`src/lib/mahjong/statsCalc.ts`）**:
  - `mahjong_personal/src/database2.py` の正本SQL集計クエリと100%同一のロジックに修正。
  - 供託収支: 二重減算していた `-1000` を完全撤廃し、DBの `round_seats.kyotaku_point` を直接合計（`SUM(rs.kyotaku_point)`）して正確な値を算出。
  - 平均打点・平均放銃点: `score_delta`（本場・供託を含む局収支）の誤参照を撤廃し、純粋な手役素点である `base_point`（基本素点）による和了点・放銃点集計へ完全一致化。
  - ノーテン罰符収支: DBの `round_seats.penalty_point` を直接合計する正本仕様に統一。
  - 守備スタッツ: 局コンテキストに基づき、被リーチ・被副露・被ダマ放銃を正しく判定。
  - 全画面で正の数値から `+` 記号を完全排除し、マイナスのみ `-` 表示に統一。
- **フィルター変更時の連動不整合解消**:
  - グループ・ルール・集計年変更時に詳細試合ID選択（アコーディオン）を自動リセット。
  - フィルター後の有効プレイヤーに合わせて、グラフ・マトリクスの表示対象メンバーを自動同期。
- `npx vitest run`: 全44件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `next build`: 全11ルート正常出力確認完了。

## Phase 5-I 完了（ノーテン罰符集計リファクタリング & 成績表示文字色ミニマル化）
- **ノーテン罰符計算の構造的リファクタリング（`src/lib/mahjong/statsCalc.ts`）**:
  - 流局時の席フィルタリングおよび二重ループ処理を完全撤廃。
  - 局の先頭でテンパイ人数（`tenpaiCount`）を確定し、単一の席ループ内の流局処理へノーテン罰符（場3,000点配分: 1人聴牌+3000/-1000、2人聴牌+1500/-1500、3人聴牌+1000/-3000）を完全統合。
  - DBの `penalty_point` 直接参照による異常値および構文エラーを構造的に解消。
- **成績テーブル文字色のミニマル化（`GameStatsTable.tsx`, `StatsDetailsTab.tsx`）**:
  - オカなしPt、順位率、和銃差、ノーテン罰符、供託収支、打点効率、平均放銃、立直/副露和了・放銃率、およびテーブルヘッダーの過剰なカラー装飾をすべて削除し、標準文字色へ統一。
- `npx vitest run`: 全44件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。

## Phase 5-J 完了（対局開始グループ二重表示解消 & グループ・メンバー管理画面刷新）
- **対局開始モーダルにおけるグループ二重表示の解消（`src/app/page.tsx`）**:
  - DB自動生成レコード（`display_id === 'free'` または `group_name === 'フリー対局'`）を通常グループ一覧の展開部から除外。
  - 末尾の選択肢表記を「グループ外対局（フリー対局）」から「フリー対局」へ統一し、重複のない直感的なUIへ整理。
- **グループ・メンバー管理画面の抜本的刷新（`src/app/manage/groups/page.tsx`）**:
  - **メンバー一覧のアコーディオン化**: メンバー多数配置による縦長化を解消し、下部「対局グループ」へのアクセス性を向上（初期状態折りたたみ・ワンタップ展開）。
  - **各メンバー行のボタン集約**: 旧「名前変更」「非表示」ボタンを「編集」ボタン1つに統合。
  - **所属グループバッジ表示**: 各メンバー行に現在所属している通常グループ一覧のバッジ（未所属表記含む）を表示。
  - **「メンバー総合編集」モーダルの新設**:
    - メンバー名変更入力
    - 外部参加者（ゲスト）設定チェックボックス（ゲスト解除により過去のゲスト対局成績も正規メンバー成績として通算合算される仕組みを明記）
    - 所属グループの複数選択・同期（`group_memberships` テーブルへのアトミックな同期）
    - メンバー非表示（アーカイブ）化ボタン（過去成績保持の安全注記付き）
- **Cloudflare Workers Static Assets 本番デプロイ運用の整理**:
  - 本番配信が Cloudflare Workers Static Assets（`wrangler.jsonc`）であることをドキュメントに明記し、デプロイフロー（`npm run build && npx wrangler deploy`）を標準化。
- `npx vitest run`: 全53件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- 本番反映（`https://mahjong-app.yd1sgc.workers.dev`）完了・実機反映確認済み。
 
## Phase 5-K 完了（ルール管理画面刷新 & 詳細ルール4タブ化 & 公式ルール整理・連盟公式新設 & UI誤タップ防止）
- **ルール作成・編集モーダルの4タブ化（`src/app/manage/rules/page.tsx`）**:
  - モーダル内に「基本設定」「点数・進行」「手役・規定」「メモ・端数」の4セグメントタブUIを導入し、縦長化を解消。
  - 試合計算に関係ない詳細ルール（赤ドラ、喰いタン、後付け、喰い替え、切り上げ満貫、パオ、役満複合、国士暗カン、フリテンリーチ、ツモ番なしリーチ、流し満貫、割れ目、ハウスルール補足メモ）を網羅的に設定・編集・保存可能化。
  - 流局ノーテン罰符、本場加算点、リーチ棒、チョンボ扱いなどの点数・進行設定を編集可能化。
- **ルール説明文生成モジュールの拡張（`src/lib/mahjong/ruleDescription.ts`）**:
  - 詳細確認モーダル（`RuleDetailModal`）で、追加された全設定項目（東風/半荘、ノーテン罰符、本場点、切り上げ満貫、赤ドラ等）が体系的に反映されるよう文言マッピングを拡張。
- **ルール一覧UIの誤タップ防止 & 視認性改善（`src/app/manage/rules/page.tsx`）**:
  - ルールカードヘッダーから「非表示」ボタンを撤去し、一覧での誤タップによるアーカイブ事故を完全防止。
  - 「詳細確認」→「このルールを編集する」モーダルのフッター下部に「このルールを非表示（アーカイブ）にする」ボタンを安全に配置。
  - ルールカード上で `[公式ルール]` / `[カスタム]` のバッジを左側、ルール名（`Mリーグ` 等）を右側に配置するレイアウトに統一。
- **ルールの短縮名化 & 重複・不要ルールの完全クリーンアップ（Supabase `rule_templates`）**:
  - 公式・カスタム全ルールの名称を短縮名称へ変更（Mリーグ、最高位戦、連盟公式、一般アリアリ、親族麻雀、麻雀部）。
  - 対局数0件の重複・未使用ルール（`preset_saikouisen`, `preset_standard`, `standard_10_30`, `gotto_5_10`, `no_uma_no_oka`）を完全削除し、成績画面（`/stats`）のプルダウンに不要な項目が残らない状態を実現。
  - 「フリー対局」グループの `default_rule_id` を公式の `一般アリアリ`（`preset_standard_ari`）へ安全に付け替え。
  - 公式サイト等の規則を照合し、日本プロ麻雀連盟公式Aルール（一発・裏ドラなし、和了連荘）を公式プリセット `preset_jpml` として新設。
  - 「親族麻雀」「麻雀部」のルールID（`rule_shinseki`, `rule_8c1c2d91`）および名称を維持したまま、流し満貫（ON）およびレートメモ（seguchipt指定）をインプレース更新。
- **SQL資産の同期（`scripts/setup_supabase_v2.sql`）**:
  - 公式ルールシード定義を最新4件（Mリーグ、最高位戦、連盟公式、一般アリアリ）に更新。
- `npx vitest run`: 全53件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。

## Phase 5-L 完了（対局中局修正機能・「その他の操作」アコーディオン・DELETEゼロ再計算）
- **「その他の操作」開閉アコーディオン新設（`src/components/ActionPanel.tsx`）**:
  - メイン領域（和了・流局、1手戻す/前局取消）の下に配置し、展開時に「局を修正」「チョンボ入力」を表示（誤タップ防止）。
- **局修正モーダル新設（`src/components/RoundEditModal.tsx`）**:
  - 過去の第1局〜最新局を選択して編集（ロン、ツモ、ダブロン、流局、チョンボ）。
  - ダブロンの複数和了者・打点個別設定、流局テンパイ、リーチ・副露宣言者の編集に対応。
  - リアルタイム全体再計算プレビュー（各プレイヤーの持ち点変動差分とゼロサム検算）を表示。
  - `history.pushState` / `popstate` 連動により、スマホの戻る操作で対局画面から離脱せずモーダルのみを安全に閉じる制御を実装。
- **DELETEゼロ・RPC排除のインプレースUPDATE方式（`src/hooks/useGameActions.ts`, `src/lib/mahjong/rules.ts`）**:
  - 純粋関数 `computeAllRoundsDetails` を新設し、第0局から副作用ゼロで全局詳細（各席の点数差分・本場点・供託点等）を算出。
  - 外部RPC依存を完全排除し、既存の `round_id` を主キーとして `rounds` および `round_seats` をインプレースに直接 `UPDATE`。局削除（DELETE）を1行も実行しないため、通信切断時でもデータ消失リスクを物理的にゼロに抑止。
- **端末残存データ（LocalStorage）の安全初期化（`src/hooks/useGameDraft.ts`）**:
  - DBへの更新が完全に成功した直後にのみ、現在局の未確定データ（下書き `draft`、副露 `furo`、立直 `riichi`、履歴 `actionHistory`）を完全初期化（`resetAllRoundData()`）。通信失敗時は下書きを維持して再試行可能。
- `npx vitest run`: 全58件 ALL PASS（局修正連鎖再計算・ダブロン供託上家取りテスト3件追加）。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。

## Phase 5-M 完了（点数プリセット表示不具合修正 & ツモ/高打点表示完全化）
- **点数プリセットデータ構造の刷新（`src/lib/mahjong/presets.ts`）**:
  - `ScorePresetItem` に `pointsLabel`（点数表記）と `hanFuLabel`（役・翻符表記）を追加。
  - 従来 `split(' ')` での空白分割に依存していたため、子ツモ（`300 / 500`）でスラッシュ以降が消失し `300` と `/` のみしか表示されなかった不具合を根本解決。
  - 親ツモ（`500オール` 等）、子ツモ（`300 / 500` 等）、高打点（`倍満` 等）の全要素で点数と役・翻符を明確に分離。
- **点数選択画面の表示修正（`src/components/round-input/ScoreStep.tsx`）**:
  - プリセットグリッド上段に `pointsLabel`、下段に `hanFuLabel` を直接描画。
  - 高打点モーダル内でも役名（倍満・三倍満・役満）と点数を正しく明示。
- **整合性テスト追加（`tests/calc.test.ts`）**:
  - 全プリセットのラベル整合性テストを新設。
- `npx vitest run`: 全59件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。
- 本番反映（`https://mahjong-app.yd1sgc.workers.dev`）デプロイ完了。

## Phase 5-N 完了（局入力アクションボタンのモノトーン高コントラスト化 & レイアウト整理）
- **「確定して次局へ」ボタンの視認性・操作性向上（`src/components/round-input/RyukyokuStep.tsx`, `ConfirmStep.tsx`）**:
  - 色数を無駄に増やさず、ダークテーマ下で最優先アクションとして認識される全幅（`w-full h-13`）の白背景・黒太字（`bg-white text-black font-black`）＋矢印表示（`→`）を導入。
  - 通常流局・途中流局・チョンボ・和了確認の確定ボタンを一貫したデザインで統一。
- **情報枠とボタンの明確な分離（`RyukyokuStep.tsx`）**:
  - ノーテン罰符や途中流局精算の四角枠（カード）を撤去し、上辺境界線とテキストによるシンプルな情報表示へ変更。押せない文字情報と決定ボタンの混同を防止。
- **聴牌選択ボタンの視認性向上（`RyukyokuStep.tsx`）**:
  - 不聴（オフ）時は枠線のみ、聴牌（オン）時は白枠線＋白太字＋`(聴牌)`で選択状態を明瞭化。
- **和了確認画面のレイアウト整理（`ConfirmStep.tsx`）**:
  - 確定ボタン（全幅・最優先）と「点数選択に戻る」ナビゲーションを縦並びで分離し、片手操作時の押しやすさ向上と誤タップ防止を両立。
- **戻る導線のボタン化（`ScoreStep.tsx`）**:
  - 目立たない下線リンクだった「関係者を変更」を枠線付きの戻るボタン（`← 戻る`）へ改修。
- `npx vitest run`: 全104件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。
- 本番反映（`https://mahjong-app.yd1sgc.workers.dev`）デプロイ完了。

## Phase 5-O 完了（局修正一括UPSERT化 & 簡易入力ロールバック保護 & デッドコード一掃）
- **局修正の直列多重更新解消 & 一括UPSERT化（`src/hooks/useGameActions.ts`）**:
  - 過去局修正時に局ごとに直列実行されていた個別UPDATE（最大30回超のHTTPリクエスト）を完全廃止。
  - 再計算対象の全局データを集約し、`rounds` テーブル1回 ＋ `round_seats` テーブル1回（複合主キー `round_id,seat` による一括UPSERT）の計2回のリクエストへ集約。
  - モバイル回線におけるレイテンシを数十倍短縮し、通信瞬断時の座席欠損・ゼロサム崩壊リスクを構造的に排除。
  - `updateRoundAndRecalculate` の依存配列に `participants` と `gameId` を補完。
- **簡易入力（結果のみ入力）のロールバック保護（`src/components/SimpleGameInputModal.tsx`）**:
  - `games` 作成後に `game_participants` の登録が失敗した場合、作成済みの `games` レコードをDELETEするロールバック処理を追加。孤立レコードの発生を防止。
- **デッドコード（`undoRound`）の完全削除（`useGameActions.ts`, `useGame.ts`, `src/app/game/page.tsx`）**:
  - `undoLastAction` に統合され、呼び出しが一切存在しなかった旧関数 `undoRound` をフック・画面インターフェースから一掃。
- **ドキュメントの最新化（`docs/AI_HANDOVER.md`）**:
  - Phase 5-L〜5-O の実績およびシステム状態・品質基準を最新同期。
- `npx vitest run`: 全104件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。

## Phase 5-P 完了（流局時テンパイ表示復元 & 局修正画面の立直・聴牌連動修正）
- **通常入力画面のテンパイ表示復元（`src/components/round-input/RyukyokuStep.tsx`）**:
  - テンパイ選択ボタンを過去の仕様に準拠した Amber 系（`bg-amber-500 text-black border-amber-400 font-black`）に復元。
  - 立直者（確定聴牌）も同等の Amber スタイルで `(立直・聴牌)` と明瞭に表示し、ボタンは操作不可（`disabled`）に固定。不聴（暗いグレー）との視覚的コントラストを確立し、「立直したのにノーテンに見える」誤認を根本解消。
  - 最下部の「流局を確定して次局へ →」ボタン（白背景・黒太字）との役割色分離を維持。
- **局修正画面の立直・聴牌連動修正（`src/components/RoundEditModal.tsx`）**:
  - 初期ロード時および「流局」タブ選択時に、立直者を自動的に `tenpai` 配列へマージ。
  - テンパイ者選択領域で立直者を `disabled` とし、タップによる不聴への誤変更を防止。
  - リーチ宣言者を追加した際にも、流局中であれば自動で聴牌に追加されるよう連動。
  - 保存・プレビューコミット時にも立直者を必ず `tenpai` に合成して送信する保証処理を配備。
- `npm test`（Vitest）: 全110件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。

## Phase 5-Q 完了（モバイルステータスバー被り解消 & 記録係引き継ぎ単一端末排他制御）
- **モバイルステータスバー被り解消（`src/app/layout.tsx`）**:
  - `statusBarStyle: "black-translucent"` および `viewportFit: "cover"` を削除し、以前の標準設定（`width: "device-width", initialScale: 1`）へ復元。
  - スマートフォンの時計、バッテリー、ノッチ・インカメラ領域とヘッダー操作ボタンが重なって操作不能になる不具合を完全解消。
- **4桁PIN引き継ぎ時の単一端末排他制御・二重操作防止（`useGameActions.ts`, `useGameData.ts`）**:
  - 新端末でのPIN引き継ぎ成功時に新しいランダム4桁PINを自動発行し、DB（`games.passcode`）をインプレース更新。
  - Supabase Realtimeの更新通知（`postgres_changes`）受信時、保持するPINが新PINと不一致となった旧端末を即座に `setIsRecorder(false)`（閲覧専用モード）へ自動降格。
  - 端末間の二重操作・同時入力を物理的に遮断し、常に引き継ぎ後の1台のみが操作権限を持つ排他制御を確立。
  - 確定済みの過去全局データ・持ち点はクラウドDBにより完全保持され、前局取り消し・局修正・精算が新端末から問題なく実行可能なことを保証。
- `npm test`（Vitest）: 全110件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全11ルート正常出力完了。
- 本番反映（`https://mahjong-app.yd1sgc.workers.dev`）デプロイ完了。

## Phase 5-R 完了（PostgreSQL ネイティブトランザクション完全配備 & 1リクエスト不可分運用）
- **新規対局作成トランザクション新設（`create_game_transaction`）**:
  - `games` と `game_participants`（4席分）を1トランザクションで不可分INSERT。
  - 参加者数が厳密に4名であることをDB境界で保証。
  - HTTP通信を2往復から1往復へ半減させ、参加者不足の破損対局を物理的に根絶。
- **局確定トランザクション改修・完全化（`commit_round_transaction`）**:
  - クライアント生成の `p_round_id` を明示的に受け取り、`rounds`、`round_seats`、`yakuman_records` すべてに同一IDを付与（round_id乖離バグを完全克服）。
  - 役満データ `p_yakumans` を引数として受け取り、同一トランザクション内で不可分にINSERT（役満ロストを物理的に根絶）。
  - 座席データが厳格に4席分であることを検証。
  - 全整数カラムに `NULLIF(val, '')::INTEGER` による安全キャスト防壁を配備。
- **クライアントコード純化（`src/app/page.tsx`, `src/hooks/useGameActions.ts`）**:
  - 旧RPC試行＋通常クエリへのフォールバック（二重構造）を完全削除。
  - 独立して実行されていた役満別クエリや手動ロールバックを一掃し、RPC呼び出し1回に純化。
- **実データ・実機検証完了**:
  - 役満（大三元）を含む局確定、通常局確定、およびCASCADE破棄クリーンアップの全動作を実機で確認完了。
- `npm test`（Vitest）: 全148件 ALL PASS。
- `npx tsc --noEmit`: 型エラー 0件。
- `npm run build`: 全14ルート正常出力完了。
- 本番反映（`https://mahjong-app.yd1sgc.workers.dev`）デプロイ完了。


