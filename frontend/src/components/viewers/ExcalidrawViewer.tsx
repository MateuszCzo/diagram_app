import { useCallback, useState, useMemo, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useDiagramWs } from '../../hooks/UseDiagramWs';
import type { PatchOp } from '../../types/Diagram';
import '@excalidraw/excalidraw/index.css';

interface ExcalidrawViewerProps {
  diagramId:       string;
  initialSnapshot: string;
}

function parseElements(snapshot: string): ExcalidrawElement[] {
  if (!snapshot) return [];
  try {
    const p = JSON.parse(snapshot);
    if (Array.isArray(p)) return p;
    if (Array.isArray(p?.elements)) return p.elements;
    return [];
  } catch { return []; }
}

function getSceneHeight(elements: ExcalidrawElement[]): number {
  if (!elements || elements.length === 0) return 300;
  const maxY = Math.max(...elements.map((el) => el.y + (el.height ?? 0)));
  return maxY + 50;
}

function notifyParentHeight(height: number) {
  window.parent.postMessage({ type: 'DIAGRAM_EMBED_HEIGHT', height }, '*');
}

export function ExcalidrawViewer({ diagramId, initialSnapshot }: ExcalidrawViewerProps) {
  const [elements, setElements] = useState<ExcalidrawElement[]>(() => parseElements(initialSnapshot));

  const height = useMemo(() => getSceneHeight(elements), [elements]);

  useEffect(() => {
    notifyParentHeight(height);
  }, [height]);

  const onInit = useCallback((snapshot: string, _pendingPatches: PatchOp[][]) => {
    setElements(parseElements(snapshot));
  }, []);

  const onPatch = useCallback((ops: PatchOp[]) => {
    const op = ops[0] as { value?: string };
    if (!op?.value) return;
    setElements(parseElements(op.value));
  }, []);

  useDiagramWs({ diagramId, onInit, onPatch });

  return (
    <div style={{ width: '100%', height }}>
      <Excalidraw
        key={JSON.stringify(elements)}
        viewModeEnabled
        initialData={{ elements }}
      />
    </div>
  );
}
