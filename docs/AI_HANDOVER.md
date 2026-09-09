# Directory Structure Map (mahjong_app)

- `src/`: アプリケーションソースコード
  - `src/app/`: Next.js App Router 画面ルーティング
  - `src/components/`: UIプレゼンテーションコンポーネント（見た目と操作イベントのみ）
  - `src/hooks/`: 状態管理・Supabase通信カスタムフック（接着剤）
  - `src/lib/`: 共通ユーティリティ
    - `src/lib/mahjong/`: 麻雀計算・純粋ドメイン層（React/Supabase非依存のPure TypeScript）
    - `src/lib/supabase.ts`: Supabaseクライアント初期化
  - `src/types/`: TypeScript型定義（DBスキーマ、対局状態等）
- `tests/`: Vitest 自動単体テスト群
- `scripts/`: 保守・運用スクリプト群（`safety_hook.py` 等）
- `docs/`: システム設計・引継・仕様書
  - `docs/AI_HANDOVER.md`: 本引継書（作業前後に必ず確認・更新）
  - `docs/DETAILED_DESIGN.md`: システム詳細設計書（正本）
  - `docs/SPECIFICATION.md`: システム基本仕様書
- `.gemini/`: AIエージェント共通ルール・安全フック設定
- `.cursorrules`: Cursor / AIエディタ共通ルール
- `next.config.ts`: 静的SPA設定 (`output: "export"`)
- `package.json`: 依存パッケージおよび実行スクリプト

---

# AI Agent Testing & Safety Protocol (必読・最重要)

1. **事前確認と説明の徹底（最重要）：**
   - コマンド実行、コード変更、ファイル編集、Git操作を行う前には、必ずユーザーに「何のために何をしようとしているか」を事前に詳しく説明すること。
   - ユーザーの明示的な了解（「進めて」「了解」「はい」など）を得る前に、勝手にコマンドを実行したり修正を進めたりしないこと。
2. **コード変更後の全テスト実行義務：**
   - 変更を加えた後は、必ず `npm test`（または `npx vitest run`）を実行し、全件 PASS することを確認すること。
3. **3層クリーンアーキテクチャの厳守：**
   - 麻雀の点数計算やルール判定は、必ず `src/lib/mahjong/` 配下に「副作用のない純粋なTypeScript関数」として実装すること。
   - UIコンポーネント内に計算コードやAPI通信を直接書く（スパゲッティ化する）ことを固く禁じる。
4. **感情表現・忖度の排除：**
   - 文章内に絵文字を一切使用しないこと。
   - お世辞や忖度を完全に排除し、技術的客観的事実のみを論理的・直線的に述べること。

---

# Current Status

- **リポジトリ初期化完了:**
  - Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS
  - `@supabase/supabase-js`, `lucide-react`, `vitest` インストール済み
  - `next.config.ts` に `output: "export"`（Cloudflare Pages静的SPA仕様）設定済み
- **安全機構・設計資産の移植完了:**
  - `.gemini/`, `.cursorrules`, `scripts/safety_hook.py` 配備済み
  - `docs/DETAILED_DESIGN.md`, `docs/SPECIFICATION.md` 配備済み
- **Phase 1完了（麻雀純粋ドメインロジック構築 & Vitestテスト全41件PASS）:**
  - `src/types/mahjong.ts`（純粋型定義）
  - `src/lib/mahjong/calc.ts`（翻・符計算、ウマオカ、オカなし）
  - `src/lib/mahjong/rules.ts`（局進行、連荘、ノーテン罰符、チョンボ、ダブロン、トビ・サドンデス判定）
  - `src/lib/mahjong/index.ts`（公開エントリポイント）
  - `tests/calc.test.ts`, `tests/rules.test.ts`（単体テスト全41件 ALL PASS）
- **Phase 2完了（Supabaseクライアント & V2型定義配備 & 突合検証完了）:**
  - `src/types/database.ts`（全8テーブル + RPC型定義）
  - `src/lib/supabase.ts`（静的SPA/テストセーフなクライアント初期化）
  - `.env.example`（接続設定テンプレート配備）
  - `next build`（静的SPA HTML出力確認完了）
  - **クラウドデータ移行・突合検証 100% PASS:**
    - PCローカルDB（`local_mahjong_v2_new.db`）のオンライン同期対象（`sync_target = 1`）27対局（300局・参加者108名）を新Supabase（`bhwbqxftifxxfmwinchx`）へ一括インポート。
    - 27対局の総素点（2,700,000点）、総ポイント（0.0pt）、全13名のプレイヤー別対局数・合計pt・素点合計がSQLiteとSupabase間で1pt・0.1%の狂いもなく完全一致することを確認済み。


- **Phase 3完了（Web対局コア画面 & 状態管理フック構築）:**
  - `src/hooks/useGame.ts`（LocalStorage下書き復元、対局状態管理、Realtime自動購読、4桁PIN引き継ぎ、0ms楽観的更新）
  - `src/components/ScoreBoard.tsx`（4名スコアボード、親マーク、点差、本場、供託）
  - `src/components/ActionPanel.tsx`（記録係専用操作ボタン、閲覧モード表示、PIN交代導線）
  - `src/components/RoundInputModal.tsx`（和了・流局入力モーダル、即時下書き保存、二重送信防止）
  - `src/components/PinTransferModal.tsx`（4桁PIN入力モーダル）
  - `src/app/game/page.tsx`（静的SPA完全対応の1画面スクロールレス対局画面）
  - `src/app/page.tsx`（対局一覧＆新規対局開始モーダル）
  - `next build`（静的SPA `/game.html`, `/index.html` 出力確認完了）

- **Phase 3.5完了（フロントエンドUI/UX再設計: mahjong_personal準拠 & 絵文字完全排除 & PC/スマホ両立）:**
  - **対局画面（`/game`）**: 2x2グリッドを廃止し、縦4行リスト（名前・持ち点: 4, 副: 1, 立: 1）へ刷新。タップによる相対点差表示トグル（青: プラス、赤: マイナス）、副露ボタン（トグル・LocalStorage保存・立直と相互排他制御）、100dvh完全スクロールレス化。
  - **和了入力モーダル（`RoundInputModal.tsx`）**: ステップ式ウィザード（誰が和了 → ロン/ツモ → 主要打点プリセット/翻符計算 → 放銃者 → 最終確認コミット）へ全面改修。
  - **アクションパネル（`ActionPanel.tsx`）**: メインアクションを「和了」「流局」の2大ボタンに整理し、スマホでのタップ領域を最大化。
  - **ホーム画面（`/`）**: 進行中の対局がある場合の自動検知再開バナー新設、巨大な「対局を始める」大ボタン配置、目的別導線の明確化。
  - **成績集計画面（`/stats`）**: 通算pt、平均順位、対局数、1〜4位分布バー、和了率、放銃率、立直率、平均素点、ラス回避率の指標グリッド整理。
  - **統合管理画面（`/manage`）**: グループ管理、ルール管理（ウマオカ・連荘・飛び賞等の設定カード）、クラウド同期ステータス画面を新設。
  - **デザイン規律**: 絵文字の完全排除、太字・大文字・高コントラスト・PC中央配置（`max-w-xl`）の統一。
  - `next build` による全静的ルート（`/`, `/game`, `/manage`, `/stats`）の正常出力確認完了。

---

# TODO (Next Actions: Phase 4)

次のチャットセッションで直ちに着手するタスク：

- [ ] **Phase 4: クラウド運用自動化 & デプロイ配備**
  - [ ] GitHub Actions による Supabase スリープ防止 cron ワークフロー配備（`.github/workflows/supabase_keepalive.yml`）
  - [ ] Cloudflare Pages 静的ホスティング向けデプロイ設定確認（カスタムドメイン/環境変数等）




