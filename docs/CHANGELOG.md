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
