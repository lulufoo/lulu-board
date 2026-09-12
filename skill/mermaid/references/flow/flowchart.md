# flowchart

Keyword: `flowchart` (also `graph`, `flowchart-elk`).
Invariant: one edge meaning per diagram. Diamonds only in category 1.

# Flowchart categories

Six application categories. **Edge meaning** is the primary discriminator.
Within a category, pick **one** sample: `minimal` (default) or `rich` (more
granularity / annotations). Do not mix samples' extra conventions casually.

## How to choose a sample

1. Choose the category by arrow meaning.
2. Use **minimal** unless the subject needs layers, multi-branch decisions,
   event labels, soft constraints, or notes.
3. Use **rich** when history-style density helps (named subgraphs, labeled
   edges, dashed soft links, multi-way diamonds).

## Disambiguation

| If arrows mean… | Category |
|-----------------|----------|
| Next step / yes-no (or multi-way) branch | 1 Decision control-flow |
| UI/system event (click, open, save) | 2 UI event flow |
| Bytes/content land somewhere | 3 Data / product pipeline |
| Module depends on module | 4 Module / layer dependency |
| Work item unlocks work item | 5 Milestone / task DAG |
| Function/file calls next in a run | 6 Partitioned call chain |

---

## 1. Decision control-flow

**Edge:** next control step / branch outcome.  
**Nodes:** process `[动作]`, decision `{条件?}`, terminals `([开始/结束])`.

### minimal

```mermaid
flowchart LR
  Start([开始]) --> Check{条件?}
  Check -->|是| Ok[动作 A]
  Check -->|否| Fail[动作 B / 失败]
  Ok --> End([结束])
  Fail --> End
```

### rich

Multi-way diamonds and parallel fan-in are allowed; still one control-flow
edge meaning.

```mermaid
flowchart TD
  Start([问题]) --> Diverge[摊出信息]
  Diverge --> Struct[结构化分桶]
  Struct --> Fixed[确定项]
  Struct --> Options[选择项]
  Struct --> Ext[外部依赖]
  Ext --> Clear{契约明确?}
  Clear -->|是| Fixed
  Clear -->|否| Hyp[列为假设]
  Fixed --> Decide[选方向]
  Options --> Decide
  Decide --> Hyp
  Hyp --> Risk{风险?}
  Risk -->|低/中| Accept[显式承认]
  Risk -->|高| Verify{能否先验?}
  Verify -->|能| Check[查证]
  Verify -->|否| Accept
  Check --> Accept
  Accept --> End([可执行边界])
```

---

## 2. UI event flow

**Edge:** user/system event.  
**Nodes:** UI / Host / Store subgraphs. Diamonds only if a real UI branch matters.

### minimal

```mermaid
flowchart TB
  subgraph UI["UI"]
    Fab[入口 FAB]
    Viewer[详情 / 编辑器]
  end
  subgraph Host["Host"]
    Open[打开句柄]
    Write[写入]
  end
  subgraph Store["存储"]
    Primary[正式数据]
    Draft[草稿缓冲]
  end
  Fab -->|create| Viewer
  Fab -->|选中| Open --> Viewer
  Viewer -->|保存| Write --> Primary
  Viewer -->|未完成| Draft
```

### rich

Prefer **labeled events** on edges; use dashed edges for soft constraints
(mutex, dismiss), not for data dependency.

```mermaid
flowchart TB
  subgraph UI["壳 UI"]
    Nav[导航 / 列表]
    Fab[主 FAB]
    PeerFab[并列 FAB]
    Viewer[viewer / editor]
  end
  subgraph Host["Host"]
    Open[打开]
    Write[写入]
    TopN[Top-N 聚合]
  end
  subgraph Store["存储"]
    Primary[正式 SSOT]
    Draft[草稿]
  end
  Fab -->|create| Viewer
  Fab -->|选中| Open --> Viewer
  Nav -->|管理打开| Open
  Fab -.->|打开前关闭面板| Fab
  PeerFab -.->|popover 互斥| Fab
  Viewer -->|退出且非空| Write --> Primary
  Viewer -->|创建中| Draft
  Draft -.->|成功或清空| Draft
  TopN -->|只读| Fab
  Primary --> TopN
  Primary --> Nav
```

---

## 3. Data / product pipeline

**Edge:** flows into / written to.  
**Not** a click-through wizard (that is 1 or 2).

### minimal

```mermaid
flowchart TB
  subgraph Work["工作区"]
    Read[read / 采集]
    Scratch[session scratch]
    Edit[write / patch]
    Read --> Scratch
    Edit --> Scratch
  end
  subgraph Archive["归档"]
    Update[update / 提交]
    Store[正式存储 + 索引]
    Update --> Store
  end
  Scratch --> Update
```

### rich

Separate **intent UI**, **agent tools**, and **durable store**; dashed edge
for optional bind/archive path.

```mermaid
flowchart TB
  subgraph App["应用 UI — 发意图"]
    Chat[对话]
    StageUi[暂存列表]
  end
  subgraph Agent["Agent — 工具"]
    Facade[facade]
    Fs[scratch fs 工具]
    StageTool[stage 工具]
  end
  Store[正式 storage]
  NoteApi[归档 / create_note]
  Chat --> Facade
  StageUi --> Facade
  Facade --> Fs
  Facade --> StageTool
  Fs --> Store
  StageTool --> Store
  Facade -.->|已绑定且用户要求归档| NoteApi
```

---

## 4. Module / layer dependency

**Edge:** depends on (depender → dependency).  
**Layout:** layers as subgraphs; no time narrative.

### minimal

```mermaid
flowchart LR
  subgraph UI["表现"]
    Page[页面]
  end
  subgraph App["应用"]
    Svc[Service]
  end
  subgraph Data["数据"]
    SSOT[SSOT / DB]
  end
  Page --> Svc --> SSOT
```

### rich

Name layers `L0…Ln` (or 表现/应用/领域/基础设施); edges stay **depends on**,
never “next step”.

```mermaid
flowchart TB
  subgraph L3["L3 编排"]
    Orch[任务分解 / 多步调用]
  end
  subgraph L2["L2 上下文"]
    Ctx[上下文组装 / RAG]
  end
  subgraph L1["L1 解码控制"]
    Decode[采样 / 系统提示]
  end
  subgraph L0["L0 模型内核"]
    Model[权重 / next-token]
  end
  Orch --> Ctx --> Decode --> Model
```

---

## 5. Milestone / task DAG

**Edge:** prerequisite / unlock.  
**Nodes:** milestones/features — not runtime modules (use 4).

### minimal

```mermaid
flowchart TD
  M1[M1 基础模型] --> M2[M2 API]
  M1 --> M3[M3 存储扩展]
  M1 --> M4[M4 UI]
  M2 --> M5[M5 端到端闭环]
  M3 --> M5
  M4 --> M5
```

### rich

Same edge meaning; show parallel unlocks and a clear integration milestone.

```mermaid
flowchart TD
  M1[FM-1 模型与持久化] --> M2[FM-2 MCP 接口]
  M1 --> M3[FM-3 归档扩展]
  M1 --> M4[FM-4 管理 UI]
  M3 --> M4
  M2 --> M5[FM-5 端到端闭环]
  M3 --> M5
  M4 --> M5
```

---

## 6. Partitioned call chain

**Edge:** invokes / next processing step in a run.  
**Subgraph:** real file/module boundary when known.

### minimal

```mermaid
flowchart LR
  subgraph CLI["CLI"]
    Main[main]
  end
  subgraph Core["core"]
    A[validate]
    B[resolve]
    C[write]
  end
  subgraph Ext["external"]
    Git[git / fs]
  end
  Main --> A --> B --> C --> Git
```

### rich

Keep subgraphs aligned to modules; linearize the happy path inside a run.

```mermaid
flowchart LR
  subgraph cli["CLI"]
    Prepare[prepare main]
  end
  subgraph prep["prepare 内部"]
    VT[validate_tasks]
    LGC[load_git_config]
    LSS[load_session_state]
    RS[resolve_slug]
  end
  subgraph gitops["git_ops"]
    PWT[prepare_worktrees]
    SR[sync_repo]
    CW[create_worktree]
  end
  subgraph external["external"]
    Git[git CLI]
    FS[workspace 文件]
  end
  Prepare --> VT --> LGC --> LSS --> RS
  Prepare --> PWT --> SR --> CW
  CW --> Git
  RS --> FS
```

---

## Anti-patterns

1. Mixing dependency arrows with "then do X" in one diagram.
2. Using `{决策}` outside category 1.
3. Turning a layering diagram into a fake timeline story.
4. Inventing a seventh ad-hoc style when one of the six fits.
5. Picking **rich** and then stripping edge labels until meaning is ambiguous.
