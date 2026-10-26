/* Document envelope: re-export board-core. */
export {
  GRAPH_ID_RE,
  encodeMetaPayload,
  decodeMetaPayload,
  splitDocument,
  joinDocument,
  stripDocumentMeta,
  sourceBody,
  newGraphId,
  isGraphId,
  assertGraphId,
  blankHashBoardSource,
  diagramTitleFromBody,
  updateMermaidTitle,
  stripPersistedMeta,
  boardTitleFromBody,
} from '../../../board-core/document-format.js';

import * as Format from '../../../board-core/document-format.js';

const DrawerDocumentMeta = Format;
export default DrawerDocumentMeta;
