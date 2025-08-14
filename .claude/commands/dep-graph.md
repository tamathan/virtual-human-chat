---
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
description: Build a dependency view (agents ↔ files/folders/MCP/agents) as mermaid/DOT for PR discussion.
---
## Steps
1) Parse `.claude/agents/*.md` for name, color, tools
2) Infer R/W intents from agent texts and command specs
3) Output a `docs/AGENT_DEPENDENCIES.md` section with mermaid graph
