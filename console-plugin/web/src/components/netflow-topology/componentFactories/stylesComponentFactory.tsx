import {
  ComponentFactory,
  GraphComponent,
  graphDropTargetSpec,
  GraphElement,
  groupDropTargetSpec,
  ModelKind,
  nodeDragSourceSpec,
  NODE_DRAG_TYPE,
  withDndDrop,
  withDragNode,
  withPanZoom,
  withSelection
} from '@patternfly/react-topology';
import * as React from 'react';

//keep default import here to use observers
import StyleEdge from '../styles/styleEdge';
import StyleGroup from '../styles/styleGroup';
import StyleNode from '../styles/styleNode';

export const stylesComponentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): React.ComponentType<{ element: GraphElement }> | undefined => {
  if (kind === ModelKind.graph) {
    return withDndDrop(graphDropTargetSpec([NODE_DRAG_TYPE]))(withPanZoom()(GraphComponent));
  }
  switch (type) {
    case 'node':
      return withDragNode(nodeDragSourceSpec('node', true, true))(withSelection()(StyleNode));
    case 'group':
      return withDndDrop(groupDropTargetSpec)(withSelection()(StyleGroup));
    case 'edge':
      return withSelection()(StyleEdge);
    default:
      return undefined;
  }
};

export default stylesComponentFactory;
