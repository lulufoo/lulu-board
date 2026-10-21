# agentflow

Keyword: `agentflow-beta`.
Invariant: agents, tools, and control or data between them. Not flowchart edge meaning.

## minimal

```mermaid
agentflow-beta
research["Research"]
research@{ shape: task }
lookup["Lookup"]
lookup@{ shape: tool }
research --> lookup
```
