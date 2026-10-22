# Mermaid type catalog

Author Mermaid 12.1.0 built-in syntax. Drawer renders flowchart with Pele 1.7.0
and mindmap with a custom SVG pipeline, not Mermaid.js. Route loads **one**
type file. `info`, `error`, and `---` are not author types.

**Open** is `flowchart` and `mindmap`. Closed types may be listed; do not
author them for the drawer.

## Aliases

| Alias | Resolves to |
|---|---|
| `uml` | `sequence` / `class` / `state` / `er` |
| `c4` | `C4Context` / `C4Container` / `C4Component` |
| `flowchart-elk` | `flowchart` |

## flow

| Type | Keyword | Open | File |
|---|---|---|---|
| flowchart | `flowchart` / `graph` | open | [flow/flowchart.md](./flow/flowchart.md) |
| block | `block` / `block-beta` | closed | [flow/block.md](./flow/block.md) |
| mindmap | `mindmap` | open | [flow/mindmap.md](./flow/mindmap.md) |
| architecture | `architecture` / `architecture-beta` | closed | [flow/architecture.md](./flow/architecture.md) |
| swimlane | `swimlane-beta` | closed | [flow/swimlane.md](./flow/swimlane.md) |
| agentflow | `agentflow-beta` | closed | [flow/agentflow.md](./flow/agentflow.md) |
| treeView | `treeView-beta` | closed | [flow/treeView.md](./flow/treeView.md) |

## design

| Type | Keyword | Open | File |
|---|---|---|---|
| sequence | `sequenceDiagram` | closed | [design/sequence.md](./design/sequence.md) |
| class | `classDiagram` / `classDiagram-v2` | closed | [design/class.md](./design/class.md) |
| state | `stateDiagram` / `stateDiagram-v2` | closed | [design/state.md](./design/state.md) |
| er | `erDiagram` | closed | [design/er.md](./design/er.md) |
| requirement | `requirement` / `requirementDiagram` | closed | [design/requirement.md](./design/requirement.md) |
| c4 | `C4Context` / `C4Container` / `C4Component` / `C4Dynamic` / `C4Deployment` | closed | [design/c4.md](./design/c4.md) |
| usecase | `usecase-beta` | closed | [design/usecase.md](./design/usecase.md) |
| eventmodeling | `eventmodeling` | closed | [design/eventmodeling.md](./design/eventmodeling.md) |
| railroad | `railroad-beta` / `railroad-ebnf-beta` / `railroad-abnf-beta` / `railroad-peg-beta` | closed | [design/railroad.md](./design/railroad.md) |

## time

| Type | Keyword | Open | File |
|---|---|---|---|
| gantt | `gantt` | closed | [time/gantt.md](./time/gantt.md) |
| journey | `journey` | closed | [time/journey.md](./time/journey.md) |
| timeline | `timeline` | closed | [time/timeline.md](./time/timeline.md) |
| gitGraph | `gitGraph` | closed | [time/gitGraph.md](./time/gitGraph.md) |
| kanban | `kanban` | closed | [time/kanban.md](./time/kanban.md) |

## chart

| Type | Keyword | Open | File |
|---|---|---|---|
| pie | `pie` | closed | [chart/pie.md](./chart/pie.md) |
| quadrant | `quadrantChart` | closed | [chart/quadrant.md](./chart/quadrant.md) |
| xychart | `xychart` / `xychart-beta` | closed | [chart/xychart.md](./chart/xychart.md) |
| sankey | `sankey` / `sankey-beta` | closed | [chart/sankey.md](./chart/sankey.md) |
| packet | `packet` / `packet-beta` | closed | [chart/packet.md](./chart/packet.md) |
| radar | `radar-beta` | closed | [chart/radar.md](./chart/radar.md) |
| treemap | `treemap` / `treemap-beta` | closed | [chart/treemap.md](./chart/treemap.md) |

## map

| Type | Keyword | Open | File |
|---|---|---|---|
| cynefin | `cynefin-beta` | closed | [map/cynefin.md](./map/cynefin.md) |
| wardley | `wardley-beta` | closed | [map/wardley.md](./map/wardley.md) |
| venn | `venn-beta` | closed | [map/venn.md](./map/venn.md) |
| ishikawa | `ishikawa` / `ishikawa-beta` | closed | [map/ishikawa.md](./map/ishikawa.md) |
