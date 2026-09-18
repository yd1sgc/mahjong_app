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
- `tests/`: Vitest 自動単体テスト群（全104件・カバレッジ92%超）
- `scripts/`: 保守・運用スクリプト（`safety_hook.py` 等）
- `docs/`: システム設計・引継・仕様書
  - `docs/AI_HANDOVER.md`: 本引継書（セッション開始時に参照）
  - `docs/CHANGELOG.md`: 過去の全改修履歴アーカイブ（必要時のみ参照）
  - `docs/DETAILED_DESIGN.md`: システム詳細設計書（正本）
  - `docs/SPECIFICATION.md`: システム基本仕様書

---

## 3. Current System Status

- **Webフロントエンド:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS, Lucide React
- **ビルド・配信:** `next.config.ts` で `output: "export"`。Cloudflare Workers Static Assets（`wrangler.jsonc`）仕様。本番反映は `npm run build && npx wrangler deploy` にて `./out` を配信。
- **本番環境URL:** `https://mahjong-app.yd1sgc.workers.dev`
- **DB / BaaS:** Supabase（PostgreSQL, Realtime, クライアント側フォールバック＆自動ロールバック標準運用、RPC適用不要）
- **CI/CD:** GitHub Actions（スリープ防止cron `supabase_keepalive.yml` 稼働中）
- **品質基準:** Vitest 全130件 PASS、ドメイン層カバレッジ 92.53%（Lines）/ 96.62%（Funcs）達成、TypeScript型エラー 0件・`as any` 完全0件達成、管理PIN（3桁: 258）による既存データ変更保護済み、流局テンパイ表示視認性復元・立直連動保証済み、デッドコード一掃（undoRound完全削除）、3層クリーンアーキテクチャ徹底、局修正一括UPSERT化（直列多重通信の解消・不可分更新）、簡易入力ロールバック保証済み、フォールバック時自動ロールバック保証済み、Promise.all並列取得による初期表示・再同期高速化済み、「百年麻雀」PWAアプリアイコン配備完了（ステータスバー被り防止のため透過全画面モードは解除・安全領域確保済み）、4桁PIN引き継ぎ時の新PIN自動再生成＆Realtime即時降格による単一端末排他制御（二重操作の完全防止）配備済み、役満記録機能配備済み（第3正規形yakuman_records、YakumanSelectModal、複合・ダブル役満対応、局修正同期、成績画面各種フィルター完全連動、実データ検証済み）、対局終了後ホーム自動遷移配備済み、飛びなしルール時の箱下立直対応（canDeclareRiichi純粋関数一元化）配備済み、対局記録UI改善（スコアボード2段化・大型ボタン・終局モーダル素点強調・点棒合計検算）配備済み
- **SQL資産:** `scripts/setup_supabase_v2.sql`, `scripts/update_transactions_rpc.sql`（RPC単体適用用）
- **登録ルール構成（短縮名称・全6件）:**
  - 公式: Mリーグ、最高位戦、連盟公式、一般アリアリ
  - カスタム: 親族麻雀、麻雀部

---

## 4. TODO (Next Actions)

- [ ] **実戦対局テスト**
  - [ ] 端末（スマホ等）による実際の対局記録・流局入力・局修正・精算・成績閲覧の通し確認

