---
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
description: Generate `.claude/agents/<name>.md` from role definition with minimal tools and color.
---
## How to use
`/spawn-agent <name>` then provide role/scope/inputs/outputs/DoD and minimal tools (including necessary MCP).

## Template
```md
---
name: <name>
description: <when and why to use>
tools: LS, Read, Edit, Write, Grep, Glob
color: violet
---
# Role
- 
# Inputs
- 
# Outputs
- 
# DoD
- 
```
