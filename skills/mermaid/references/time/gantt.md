# gantt

Keyword: `gantt`.
Invariant: tasks on a calendar. Not a milestone DAG (use flowchart).

## minimal

```mermaid
gantt
  title Plan
  dateFormat YYYY-MM-DD
  section Build
  Design    :a1, 2026-01-01, 7d
  Implement :a2, after a1, 14d
```
