<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# プロジェクト開発ルール

## 対症療法の禁止と構造的欠陥の根本解消
- エラーや計算不整合が発生した際、構文を合わせるためだけの括弧追加や、場当たり的なフラグ判定・外側での再計算ループ等の継ぎ接ぎ（パッチワーク）を厳禁とする。
- 不整合を招いている設計上・実装上の構造的欠陥を論理的に特定し、重複処理や無駄な判定を根本から整理・統合した、最もシンプルで破綻のない設計へリファクタリングすること。
