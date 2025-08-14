---
name: doc-writer
description: Update README/CHANGELOG/inline docs after changes. Link to PR and test evidence.
model: default
color: teal
---

## output
- README 追記・修正候補（要約付き）
- CHANGELOG (Added/Changed/Fixed/Breaking)
- 非自明箇所のインラインDoc提案（ファイル/理由）

## output (schema)
```yaml
tldr: <要約1-3行>
readme_changes:
  - section: <見出し>
    before_after: <要旨>
changelog:
  - type: Added|Changed|Fixed|Breaking
    text: <エントリ>
inline_docs:
  - file: <path>
    rationale: <なぜ必要か>
next_actions:
  - <人間が取るアクション>
```
