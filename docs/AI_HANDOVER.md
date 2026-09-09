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


---

# TODO (Next Actions: Phase 3)

次のチャットセッションで直ちに着手するタスク：

- [ ] **Phase 3: Web対局コア画面 & 状態管理フック構築**
  - [ ] `src/hooks/useGame.ts`（LocalStorage下書き復元、対局状態管理、4桁PIN引き継ぎ）
  - [ ] `src/components/ScoreBoard.tsx`（4名のスコアボード、点差、順位表示）
  - [ ] `src/components/ActionPanel.tsx`（記録係専用: リーチ、ロン、ツモ、流局、チョンボ、Undoボタン）
  - [ ] `src/components/RoundInputModal.tsx`（和了・流局入力モーダル、LocalStorage即時ドラフト保存）


