import { useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useDiagramWs, type WsStatus } from '../../hooks/UseDiagramWs';
import type { PatchOp } from '../../types/Diagram';
import '@excalidraw/excalidraw/index.css';

interface Props {
  diagramId:       string;
  initialSnapshot: string;
  onStatusChange?: (status: WsStatus) => void;
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

export function ExcalidrawEditor({ diagramId, initialSnapshot, onStatusChange }: Props) {
  const apiRef           = useRef<ExcalidrawImperativeAPI | null>(null);
  const ignoreNextChange = useRef(false);
  const lastSentRef      = useRef<string>('');
  const isInitializedRef = useRef(false);

  const onInit = useCallback((snapshot: string, _pendingPatches: PatchOp[][]) => {
    const elements = parseElements(snapshot);
    console.log(`[Excalidraw] onInit — elements: ${elements.length}`);

    isInitializedRef.current = true;
    ignoreNextChange.current = true;
    lastSentRef.current = JSON.stringify(elements);
    apiRef.current?.updateScene({ elements });
  }, []);

  const onPatch = useCallback((ops: PatchOp[]) => {
    const op = ops[0] as { value?: string };
    if (!op?.value) return;

    const elements = parseElements(op.value);
    console.log(`[Excalidraw] onPatch — elements: ${elements.length}`);

    ignoreNextChange.current = true;
    lastSentRef.current = JSON.stringify(elements);
    apiRef.current?.updateScene({ elements });
  }, []);

  const onError = useCallback((code: string) => {
    if (code === 'DIAGRAM_DELETED') {
      alert('This diagram has been deleted.');
      window.history.back();
    }
  }, []);

  const onWsClose = useCallback(() => {
    isInitializedRef.current = false;
    ignoreNextChange.current = false;
  }, []);

  const { sendPatch } = useDiagramWs({ diagramId, onInit, onPatch, onError, onClose: onWsClose, onStatusChange });


  const onChange = useCallback((elements: readonly ExcalidrawElement[]) => {
    if (!isInitializedRef.current) return;

    if (ignoreNextChange.current) {
      ignoreNextChange.current = false;
      return;
    }

    const serialized = JSON.stringify(elements);
    if (serialized === lastSentRef.current) return;

    console.log(`[Excalidraw] onChange — sending ${elements.length} elements`);
    lastSentRef.current = serialized;

    sendPatch([{ value: serialized } as unknown as PatchOp]);
  }, [sendPatch]);


  useEffect(() => {
    lastSentRef.current = JSON.stringify(parseElements(initialSnapshot));
  }, [initialSnapshot]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        onChange={onChange}
      />
    </div>
  );
}