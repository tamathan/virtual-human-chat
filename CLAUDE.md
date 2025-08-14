# CLAUDE.md

**目的**：Plan → **/think hard** → Diff → Test → 実行ログ要約 → Commit の型で、安全かつ一貫して開発を進める。

## 方針
**サブエージェント**との協働方針: @docs/rules/collab_policy.md　を確認して、しっかりと協同すること。

## Tech Stack（概要）
- Framework: **Next.js (TypeScript)**
- Styling: **Tailwind CSS**
- UI Components: **shadcn/ui**
- Database: **SQLite（開発/テスト）→ Firebase / Supabase / Cloud SQL（本番候補）**
- MCP: **playwright / github / firebase / cloud-run / context7**

## Directory Structure（基本）
- `app/`（App Router）: ルート・レイアウト・サーバーコンポーネント
- `components/`: UIコンポーネント（**shadcn/ui** ベース）
- `lib/`: 汎用ユーティリティ
- `server/` or `data/`: サーバー動作・DBアクセス層（直SQLは避ける）
- `tests/` / `__tests__/`: 単体・統合・E2E（**Playwright** 優先）

## Naming Rules（抜粋）
- コンポーネント/型: **PascalCase**
- 変数/関数: **camelCase**
- ファイル/フォルダ: **kebab-case** を基本（Next.js の規約に従う）
- UI: **shadcn/ui** の命名・構成に準拠（atoms → molecules → organisms の順で抽象化）

## Setup（最小手順）
1. `npm ci`（または `pnpm i`）
2. `.env` を `.env.example` から作成（秘密は編集禁止、ダミー値のみ）
3. 開発サーバ: `npm run dev`
4. テスト: `npx playwright test`（E2E） / `npm test`（ユニット）
5. デプロイ（想定）: Firebase Hosting → Cloud Run（**asia-northeast1**）

## References（詳細はインポート）
- 協働方針: @docs/rules/collab_policy.md
- サブエージェント: @docs/rules/subagents.md
- スクリプト一覧: @package.json
- README: @README.md
- 引継ぎ: @docs/HANDOFF_FOR_CLAUDE.md（直近の作業/ログ/次アクション）
- 変更履歴: @docs/CHANGES.md
- 技術仕様: @docs/AUDIO_WORKLET.md / @docs/TYPE_SYSTEM.md

> CLAUDE.md は「概要と合意」を保持し、詳細は上記の **@インポート** へ分割して参照します。
