import { useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { compare, applyPatch, type Operation } from 'fast-json-patch';
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
  const skipRef          = useRef(0);
  const prevElementsRef  = useRef<readonly ExcalidrawElement[]>([]);
  const isInitializedRef = useRef(false);
  const isUnmountingRef  = useRef(false);

  useEffect(() => {
    return () => { isUnmountingRef.current = true; };
  }, []);

  const applyRemote = useCallback((elements: readonly ExcalidrawElement[]) => {
    skipRef.current += 3;
    apiRef.current?.updateScene({ elements });
    setTimeout(() => {
      const actual = apiRef.current?.getSceneElements();
      if (actual && actual.length > 0) {
        prevElementsRef.current = structuredClone(actual);
      }
    }, 100);
  }, []);

  const onInit = useCallback((snapshot: string, _pendingPatches: PatchOp[][]) => {
    const elements = parseElements(snapshot);
    isInitializedRef.current = true;
    applyRemote(elements);
  }, [applyRemote]);

  const onPatch = useCallback((ops: PatchOp[]) => {
    try {
      const base = { elements: prevElementsRef.current };
      const { newDocument } = applyPatch(base, ops as Operation[], false, false);
      const elements = (newDocument as typeof base).elements;
      applyRemote(elements);
    } catch (e) {
      console.error('[Excalidraw] onPatch — applyPatch failed:', e);
    }
  }, [applyRemote]);

  const onError = useCallback((code: string) => {
    if (code === 'DIAGRAM_DELETED') {
      alert('This diagram has been deleted.');
      window.history.back();
    }
  }, []);

  const onWsClose = useCallback(() => {
    isInitializedRef.current = false;
    skipRef.current = 0;
  }, []);

  const { sendPatch } = useDiagramWs({ diagramId, onInit, onPatch, onError, onClose: onWsClose, onStatusChange });

  const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState) => {
    if (isUnmountingRef.current) return;
    if (!isInitializedRef.current) return;

    if (skipRef.current > 0) {
      skipRef.current -= 1;
      return;
    }

    const ops = compare(
      { elements: prevElementsRef.current },
      { elements: structuredClone(elements) },
    );

    if (ops.length === 0) return;

    prevElementsRef.current = structuredClone(elements);
    sendPatch(ops as PatchOp[]);
  }, [sendPatch]);

  useEffect(() => {
    prevElementsRef.current = structuredClone(parseElements(initialSnapshot));
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