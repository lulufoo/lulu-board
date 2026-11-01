/* Shared palette pack: default. Colors come from the frozen Light table. */
import light from '../appearance/light.js';

export default {
  id: 'default',
  label: 'Default',
  color: light.diagram.color,
  edgeStroke: light.diagram.edgeStroke,
  edgeLabel: light.diagram.edgeLabel,
  edgeEvidence: light.diagram.edgeEvidence,
  edgeFeedback: light.diagram.edgeFeedback,
  bandBg: light.diagram.bandBg,
  bandBorder: light.diagram.bandBorder,
  edgeRgb: light.diagram.edgeRgb,
  colors: light.diagram.colors,
};
