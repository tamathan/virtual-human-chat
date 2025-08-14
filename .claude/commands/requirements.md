---
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
description: Convert user requests/conversations into an SRS draft and list open questions.
---
## How to use
`/requirements "<Title>"` then paste the conversation/notes in the next message.

## Steps
1) Extract goals, constraints, and uncertainties
2) Create `docs/requirements/SRS-<slug>.md` from the template
3) Fill acceptance criteria and NFR
4) Output the file path and open-questions
