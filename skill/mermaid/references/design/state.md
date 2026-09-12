# state

Keyword: `stateDiagram-v2` (prefer over `stateDiagram`).
Invariant: states and labeled transitions.

## minimal

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Open : open
  Open --> Saving : submit
  Saving --> Idle : success
  Saving --> Open : failure
  Open --> Idle : cancel
```

## rich

```mermaid
stateDiagram-v2
  direction TB
  state "incomplete" as S_incomplete
  state "complete" as S_complete
  state "incomplete" as M_incomplete
  state "complete" as M_complete
  state "SubTask" as Sub {
    [*] --> S_incomplete: create
    S_incomplete --> S_complete: complete_sub
  }
  state "Master" as Master {
    [*] --> M_incomplete: create
    M_incomplete --> M_complete: all subs complete
    M_complete --> M_incomplete: add incomplete sub
  }
  S_complete --> Master: recompute
```

Distinct ids (`S_*` / `M_*`) keep cross-composite edges drawable; quoted labels
keep visible text short. Shared ids make `complete --> Master` a child→parent
path that Mermaid collapses to a point.
