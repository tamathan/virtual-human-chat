---
allowed-tools:
  - PowerShell(Get-ChildItem -Force -Name -Path **)
  - Read
  - Edit
  - Write
  - Grep
  - Glob
description: Create or update README.md in each subfolder using the template, without overwriting existing content.
---
## How to use
`/doc-sync <path>` (e.g., apps / packages / .)

## Steps
1) List directories under <path> (excluding node_modules, .git, .claude)
2) If README.md not present -> generate from `docs/templates/README_SUBFOLDER.md`
3) If present -> append missing sections only
4) Print the list of touched files
