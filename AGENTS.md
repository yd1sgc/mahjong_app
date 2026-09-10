<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# プロジェクト開発ルール

## 1. 実行モデル：方針B（限定的自律実行・最優先規定）
- 【計画フェーズ】
  タスク着手時は、情報収集（ファイル閲覧や検索）を行った上で、コード変更前に必ず「何のために何をしようとしているか」の全体計画をユーザーに提案し、明示的な実行許可を得ること。
- 【実行フェーズ（自律実行）】
  計画に対する許可を得た後は、その計画の目的を達成するために必要な「ローカルソースコードの編集・作成」「動作確認・テスト用コマンドの実行（`npm test` 等）」については、都度の許可を求めず自律的・連続して実行し、完了後に結果を報告すること。
- 【再確認が必要な操作（自律実行の対象外）】
  計画合意後であっても、以下の操作を行う場合は必ず事前に目的と内容を説明して明示的な許可を得ること。
  1. 外部データベース（Supabase等）に対するスキーマ変更・データ変更
  2. Gitのコミットやプッシュなど、履歴・リモートへの反映操作
  3. 当初の計画に含まれない新しい要件の追加や、大幅なアーキテクチャ変更
  4. エラー等により代替操作へ切り替える必要がある場合

## 2. 対症療法の禁止と構造的欠陥の根本解消
- エラーや計算不整合が発生した際、構文を合わせるためだけの括弧追加や、場当たり的なフラグ判定・外側での再計算ループ等の継ぎ接ぎ（パッチワーク）を厳禁とする。
- 不整合を招いている設計上・実装上の構造的欠陥を論理的に特定し、重複処理や無駄な判定を根本から整理・統合した、最もシンプルで破綻のない設計へリファクタリングすること。

## 3. ドキュメント参照・管理規律（コンテキスト肥大化防止）
- セッション開始時は、凝縮された `docs/AI_HANDOVER.md` のみを読み込み、システム全体像・過去アプリ引き継ぎ要件・直近TODOを把握すること。
- 過去の完了履歴（Phase 1〜5-I 等）を詳細に調査する必要が生じた場合のみ、`docs/CHANGELOG.md` をピンポイントで参照すること（通常のセッション開始時に読み込む必要はない）。
- ロジック・型・データ処理に関わるコード変更を行った際は、必ず `npm test`（Vitest）を実行し、全テストが合格することを確認すること（ドキュメント編集や軽微なUI文言・スタイル修正時はテスト実行を省略可）。
- 文章内に絵文字を使用しないこと。客観的・論理的事実のみを直線的に述べること。

