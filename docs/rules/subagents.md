# Subagents Runbook (MCP-first)

## 運転ルール
1) 非トリビアル変更は **choreographer** を先に使い、各ステップに **MCP** を割り当てる
   - 優先度: **playwright**(E2E/調査/スクショ) > **github**(PR/Draft/コメント) > **firebase**(エミュ/デプロイ検証) > **cloud-run**(デプロイ/ヘルス) > **context7**(最新版ドキュメント注入)
2) 実装は小さく（diff最小）。PR後は **pr-reviewer** で LGTM 判定
3) **test-runner** で検証（UIなら playwright を優先）→ 失敗時は **debugger**
4) 収束後は **doc-writer** で README/CHANGELOG 更新
5) 出力は **TL;DR → サマリ表 → チェックリスト → 次アクション** の順で統一

## PlaywrightでのWeb検索レシピ
- 検索エンジンに遷移→クエリ入力→結果クロール→候補詳細→スクショ保存→要約表
- 失敗時は selector 修正・待機の見直し・user-agent/viewport 指定を試す

## 呼び出し例
- Plan→実装→レビュー→テスト：
  - Use **choreographer** to propose a 3-step plan. Then **refactorer** for step 1, **pr-reviewer** to gate, and **test-runner** to verify.
- 失敗の切り分け：
  - Ask **debugger** to isolate root cause of this failing test. Then hand back to **test-runner** to verify.
- 文書追随：
  - After merging, use **doc-writer** to update README and CHANGELOG with rationale.

---

## GPT‑5 Prompting Guide から取り入れたポイント（Claude向け適用）
- **Agentic eagerness の調整**: 小タスクは「最小探索→すぐ実行」を徹底。大タスクは計画→完了まで粘る（/think hard と MAX_THINKING_TOKENS で制御）。
- **Tool preambles**: 長い実行は「最初に短い計画→進捗の段階報告→完了サマリ」。人が追えるようにする。
- **構造化出力**: すべてのエージェントに **YAML スキーマ**を定義（TL;DR/表/チェックリスト/次アクション）。
- **矛盾の除去**: 「〜しても良い」等の曖昧表現を避け、禁止事項・厳密要件は**Hard requirements**として明示。
- **最小推論**: 低レイテンシ場面は “説明最小+計画は内部で” を指示し、最終出力だけを**スキーマ**で返す。
- **メタプロンプト**: 失敗時は **choreographer** に“プロンプトの最小修正”を提案させて再実行。


---

**関連:** 詳細な協働方針は `docs/rules/collab_policy.md` を参照。
