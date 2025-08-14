---
allowed-tools:
  - PowerShell(git status:*)
  - PowerShell(git diff:*)
  - PowerShell(git add:*)
  - PowerShell(git commit:*)
  - PowerShell(git push:*)
  - Read
  - Edit
  - Write
  - Grep
  - Glob
description: Process a ticket through Planner → Implementer → Reviewer with clear DoD.
---
## Context
- Git status: !`git status --porcelain`
- Diff: !`git diff --unified=0 HEAD`

## Steps
1) Planner creates plan.json
2) Implementer applies minimal change and tests
3) Reviewer checks security/quality and drafts PR notes
