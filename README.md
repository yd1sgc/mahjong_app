# 百年麻雀 (mahjong_app)

クラウド同期・リアルタイム麻雀スコア管理Webシステム。  
四麻の対局進行、スコアボードのリアルタイム共有、および詳細な個人・グループ成績集計・分析を提供します。

---

## 1. システム概要と特徴

- **リアルタイム卓同期:** 卓上の記録係端末が入力した結果が、同卓者や観戦者の端末へ即座にWebSocket同期（Supabase Realtime）。
- **4桁PIN交代制・単一排他制御:** 同時入力による不整合を防止するため、記録係の操作権限は単一端末に限定。4桁PINによる交代と新PIN自動再生成による即時排他制御を実装。
- **100dvh スクロールレス対局画面:** 卓上で直感的に操作できる縦並び4名スコアボード、和了・流局・チョンボの段階的モーダル入力。
- **純粋ドメイン層による厳格なルール判定:** 連荘・トビ・サドンデス・ノーテン罰符・点数計算・役満記録をフロントエンドの純粋TypeScript関数群（`src/lib/mahjong/`）で完全制御。
- **高度な成績分析:** 試合成績一覧、ポイント推移グラフ、雀風スタイル散布図（立直×副露、和了×放銃、ヤコビ法主成分分析［PCA］）、相性マトリクス、役満・連勝レコード。
- **オフライン・誤操作耐性:** LocalStorage自動下書き保存によるブラウザ再読み込み時の復元、およびSupabaseネイティブトランザクションRPCによる1リクエスト完全不可分コミット。

---

## 2. 技術スタック

| レイヤー | 採用技術 | 備考 |
| :--- | :--- | :--- |
| **フロントエンド** | Next.js 16 (App Router), React 19, TypeScript 5 | 静的SPAエクスポート (`output: 'export'`) |
| **スタイリング** | Tailwind CSS v4, Lucide React | 高コントラスト・ダークテーマ |
| **BaaS / DB** | Supabase (PostgreSQL, Realtime) | 第3正規形、RLS、ネイティブRPC |
| **ホスティング** | Cloudflare Pages / Workers Static Assets | エッジ高速静的配信 |
| **テスト** | Vitest 5, `@vitest/coverage-v8` | 純粋ドメイン層テスト |

---

## 3. ディレクトリ構成

```text
mahjong_app/
├── src/
│   ├── app/                 # Next.js App Router 画面ルーティング
│   │   ├── (home)           # 対局一覧・新規対局作成
│   │   ├── game/            # 対局記録・スコアボード画面
│   │   ├── stats/           # 成績・分析ダッシュボード
│   │   ├── aggregate/       # 合計集計画面
│   │   └── manage/          # 管理画面（ルール、メンバー・グループ、システム統計）
│   ├── components/          # UIコンポーネント（対局、入力モーダル、成績グラフ等）
│   ├── hooks/               # 状態管理・Supabase通信カスタムフック
│   ├── lib/                 # 共通ユーティリティ
│   │   ├── mahjong/         # 麻雀計算・純粋ドメイン関数群（calc, rules, statsCalc 等）
│   │   ├── adminAuth.ts     # 管理者PIN認証ユーティリティ
│   │   └── supabase.ts      # Supabaseクライアント初期化
│   └── types/               # TypeScript型定義（mahjong, database）
├── tests/                   # Vitest 単体テスト群
├── scripts/                 # 保守・運用・DBセットアップSQLおよびスクリプト
├── docs/                    # システム引継・設計書・仕様書
│   ├── AI_HANDOVER.md       # AIエージェント向け最新状況集約書
│   ├── DETAILED_DESIGN.md   # システム詳細設計書（正本）
│   ├── SPECIFICATION.md     # システム基本仕様書
│   └── CHANGELOG.md         # 改修履歴アーカイブ
├── public/                  # PWAアプリアイコン等の静的アセット
├── wrangler.jsonc           # Cloudflare Workers静的配信設定
└── next.config.ts           # Next.js 静的エクスポート設定
```

---

## 4. 開発・運用コマンド

### 依存パッケージのインストール
```bash
npm install
```

### 開発サーバー起動
```bash
npm run dev
```

### 単体テスト実行
```bash
# 全テスト実行
npm test

# カバレッジレポート出力
npm run test:cov
```

### ビルドと静的エクスポート
```bash
npm run build
```
ビルド完了後、`./out` ディレクトリに完全静的ファイルが出力されます。

### 本番デプロイ (Cloudflare Workers)
```bash
npm run build
npx wrangler deploy
```

---

## 5. 設計書・引き継ぎドキュメント

開発や改修の際は、まず以下のドキュメントを参照してください。

1. [`docs/AI_HANDOVER.md`](file:///c:/Users/segu1/MyFiles/開発/repos/mahjong_app/docs/AI_HANDOVER.md): セッション開始時必読の最新サマリと直近タスク
2. [`docs/DETAILED_DESIGN.md`](file:///c:/Users/segu1/MyFiles/開発/repos/mahjong_app/docs/DETAILED_DESIGN.md): 画面設計・データ構造・RPC仕様の詳細正本
3. [`docs/SPECIFICATION.md`](file:///c:/Users/segu1/MyFiles/開発/repos/mahjong_app/docs/SPECIFICATION.md): システム基本要件・ルール体系の定義
