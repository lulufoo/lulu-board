/* early head — mode + tool flags before first paint */
(function () {
  var mode = 'mermaid';
  var diagramType = '';
  try {
    var q = new URLSearchParams(location.search).get('mode');
    var parsed = JSON.parse(localStorage.getItem('drawer.ui') || 'null');
    if (q === 'board' || q === 'mermaid') mode = q;
    else if (parsed && (parsed.mode === 'board' || parsed.mode === 'mermaid')) mode = parsed.mode;
    if (parsed && parsed.diagramType) diagramType = String(parsed.diagramType);
  } catch (e) {}
  document.documentElement.dataset.drawerMode = mode;
  // Hide canvas until first transform is applied (Board + Mermaid) to avoid left-flash.
  document.documentElement.dataset.drawerBoot = '1';
  if (mode !== 'mermaid') return;
  var low = diagramType.toLowerCase();
  var mindmap = low === 'mindmap';
  var stateDiag = low === 'statediagram' || low === 'statediagram-v2';
  var flowchart = (!low || low === 'flowchart' || low === 'graph') && !mindmap && !stateDiag;
  // Mindmap: show mindmap Delete from first paint (never flash flowchart tools first).
  // Unknown/empty type: keep flowchart tools visible (legacy FOUC guard); setTypeUI corrects.
  document.documentElement.dataset.mermaidFlowchart = flowchart ? '1' : '0';
  document.documentElement.dataset.mermaidMindmap = mindmap ? '1' : '0';
  document.documentElement.dataset.mermaidState = stateDiag ? '1' : '0';
})();
