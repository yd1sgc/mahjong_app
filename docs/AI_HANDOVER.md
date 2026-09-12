# AI Handover & Project Summary (mahjong_app)

本ドキュメントは、新規セッション開始時にAIエージェントがシステムの前提・アーキテクチャ・直近タスクを即座に把握するための集約書です。
※過去の詳細な改修履歴（Phase 1〜5-I）は `docs/CHANGELOG.md` に保管されています（必要時のみ参照）。

---

## 1. 過去アプリ（mahjong_personal）からの引き継ぎ重要原則

本プロジェクトは、先行稼働していたPCローカル環境（Python / Streamlit + SQLite: `local_mahjong_v2_new.db`）の資産を継承し、複数端末リアルタイム共有可能なWebアプリ（Next.js + Supabase on Cloudflare Pages）として構築されたハイブリッドシステムです。以下の正本仕様を厳格に維持してください。

1. **データと計算ロジックの正本準拠:**
   - 過去27対局（300局・参加者108名）のデータはクラウドSupabaseに完全一致移行済み。
   - 成績集計ロジックは元アプリの正本SQL仕様（`database2.py`）に厳密準拠すること。
     - 供託収支: `round_seats.kyotaku_point` を直接集計。
     - 平均打点・放銃点: 本場や供託を含まない手役素点 `base_point` で集計。
     - 流局ノーテン罰符: 場3,000点配分（1人聴牌+3000/-1000、2人聴牌+1500/-1500、3人聴牌+1000/-3000）。
2. **純粋ドメイン層の分離（3層クリーンアーキテクチャ）:**
   - 麻雀の点数計算、ウマオカ、連荘・飛び・サドンデス判定は `src/lib/mahjong/` 配下に副作用のない純粋TypeScript関数として実装すること。
   - UIコンポーネント内に計算コードやAPI通信を直接書くことを禁じる。
3. **UI/UX原則（mahjong_personal準拠）:**
   - 対局画面（`/game`）は4名縦並びスコアボード、100dvh完全スクロールレス。
   - 文章・画面内での絵文字は完全排除。
   - 太字・高コントラスト・PC中央配置（`max-w-xl`）を維持。

---

## 2. Directory Structure Map

- `src/`: アプリケーションソースコード
  - `src/app/`: Next.js App Router 画面ルーティング（`/`, `/game`, `/stats`, `/aggregate`, `/manage/*`）
  - `src/components/`: UIプレゼンテーションコンポーネント
  - `src/hooks/`: 状態管理・Supabase通信カスタムフック（`useGameDraft`, `useGameData`, `useGameActions`）
  - `src/lib/`: 共通ユーティリティ
    - `src/lib/mahjong/`: 麻雀計算・純粋ドメイン層（`calc.ts`, `rules.ts`, `statsCalc.ts`, `presets.ts`）
    - `src/lib/supabase.ts`: Supabaseクライアント初期化
  - `src/types/`: TypeScript型定義（`mahjong.ts`, `database.ts`）
- `tests/`: Vitest 自動単体テスト群（全44件）
- `scripts/`: 保守・運用スクリプト（`safety_hook.py` 等）
- `docs/`: システム設計・引継・仕様書
  - `docs/AI_HANDOVER.md`: 本引継書（セッション開始時に参照）
  - `docs/CHANGELOG.md`: 過去の全改修履歴アーカイブ（必要時のみ参照）
  - `docs/DETAILED_DESIGN.md`: システム詳細設計書（正本）
  - `docs/SPECIFICATION.md`: システム基本仕様書

---

## 3. Current System Status

- **Webフロントエンド:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS, Lucide React
- **ビルド・配信:** `next.config.ts` で `output: "export"`（Cloudflare Pages/Workers Static Assets 静的SPA仕様）
- **本番環境URL:** `https://mahjong-app.yd1sgc.workers.dev`
- **DB / BaaS:** Supabase（PostgreSQL, RLS, Realtime, RPCトランザクション配備済み）
- **CI/CD:** GitHub Actions（スリープ防止cron、自動デプロイ連携済み）
- **品質基準:** Vitest 全51件 PASS（結果のみ入力テスト・ダブロン・上家取り・途中流局・四人リーチテスト含む）、TypeScript型エラー 0件、`next build` 全ルート正常出力確認済み

---

## 4. TODO (Next Actions)

- [ ] **本番デプロイ確認**
  - [ ] Gitコミット & プッシュにより Cloudflare本番環境へ最新コードを反映
- [ ] **実戦対局テスト**
  - [ ] 端末（スマホ等）による実際の対局記録・精算・成績閲覧の通し確認
