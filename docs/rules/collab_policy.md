# Claude Code 協働方針（Collaboration Policy）

**目的**：Plan → **/think hard** → Diff → Test → 実行ログ要約 → Commit の型で、安全かつ一貫して開発を進める。

## Claude Codeとの協働方針
- TypeScript / React（**shadcn/ui**）の開発を加速する
- デプロイ：Firebase Hosting → Cloud Run（**asia-northeast1** を想定）
- サブエージェントの分業を徹底する（下表の役割対応を参照）

### 役割 ↔ サブエージェント対応表
| 役割（要望） | 担当サブエージェント / 実体 | 補足 |
|---|---|---|
| planner | **choreographer** | 計画・分割・MCP割当（playwright/github/firebase/cloud-run/context7） |
| implementer | **main**（必要に応じて **refactorer**） | 実装はメイン文脈で行い、構造変更は refactorer が担当 |
| reviewer | **pr-reviewer** | LGTM/NOT の品質ゲート、必要なら GitHub MCP で Draft PR/コメント |
| requirements-analyst | **fact-checker** + **doc-writer** | 仕様の裏取り（出典/スクショ）とREADME/CHANGELOGの反映 |
| team-orchestrator | **choreographer** | 全体オーケストレーションと段階投入の管理 |

## 原則
1. **最小権限**：tools は必要最小に限定。MCP は用途が明確なときのみ追加・使用。危険コマンドは hooks/permissions でブロック。
2. **一点特化**：各エージェントは単一責務に集中（設計・実装・レビュー・検証・文書化・裏取り）。
3. **可視化**：成果物は **TL;DR → 表 → チェックリスト → 次アクション →（必要に応じて）証跡**（スクショ/ログ/URL）で人間に判定材料を提示。

## 実行方針（運用フロー）
1. **Plan**：関連ファイルを調査し、変更範囲・影響・リスクを箇条書き化（**choreographer**）  
2. **/think hard**：代替案・落とし穴・削減できる変更・テスト戦略を強化思考で洗い出し（必要に応じて **MAX_THINKING_TOKENS** を上げる）  
3. **Diff 提案**：最小差分 → 段階的拡張。規約に反する場合は理由と代案を明示  
4. **Test**：既存テストの更新 → 不足テストの追加 → 実行（**test-runner**／UIは **playwright** 優先）  
5. **Run & Summary**：実行結果と残タスクを要約（表/チェックリスト/証跡）  
6. **Commit**：1PRは小さく。メッセージは要約＋根拠。必要時は **pr-reviewer** で LGTM/NOT を出す

## 新規エージェントのチェックリスト（作成規約）
- フロントマターに **`name / description / color`** を必須とし、必要に応じて `model`・`tools` を定義（color は役割別の系統色）。
- **入力 / 出力 / 終了条件（DoD）** を明記する。出力は **YAMLスキーマ**で構造化。
- tools は `Read/Edit/Write/Grep/Glob` を基本。**Bash は極力避け**、必要な場合は限定コマンドのみ（Slash Command 的にパターンを固定）。
- **MCP ツールは必要なものだけ**を使用し、/tools で実名を確認してから呼び出す（playwright/github/firebase/cloud-run/context7）。
- 可能な範囲で **証跡**（URL/スクショ/保存パス）を出力に含める。

> このポリシーは CLAUDE.md を膨らませないため **別ファイル**に保持します。実際のプロンプト・スキーマ・サンプルは `.claude/agents/` を参照してください。
