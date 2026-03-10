import { useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { compare, applyPatch, type Operation } from 'fast-json-patch';
import { useDiagramWs, type WsStatus } from '../../hooks/useDiagramWs';
import type { PatchOp } from '../../types/Diagram';

import '@excalidraw/excalidraw/index.css';

interface ExcalidrawEditorProps {
  diagramId:        string;
  initialSnapshot:  string;
  onStatusChange?:  (status: WsStatus) => void;
}

export function ExcalidrawEditor({ diagramId, initialSnapshot, onStatusChange }: ExcalidrawEditorProps) {
  const apiRef      = useRef<ExcalidrawImperativeAPI | null>(null);
  const prevStateRef = useRef<{ elements: readonly ExcalidrawElement[]; appState: Partial<AppState> } | null>(null);
  const isRemoteUpdate = useRef(false);

  const loadSnapshot = useCallback((snapshot: string) => {
    if (!apiRef.current || !snapshot) return;
    try {
      const { elements, appState } = JSON.parse(snapshot);
      apiRef.current.updateScene({ elements, appState });
      prevStateRef.current = { elements, appState };
    } catch {
      console.error('[Excalidraw] Failed to parse snapshot');
    }
  }, []);

  const onInit = useCallback((snapshot: string, pendingPatches: PatchOp[][]) => {
    let base = snapshot ? JSON.parse(snapshot) : { elements: [], appState: {} };

    for (const ops of pendingPatches) {
      const { newDocument } = applyPatch(base, ops as Operation[], false, false);
      base = newDocument;
    }

    loadSnapshot(JSON.stringify(base));
  }, [loadSnapshot]);

  const onPatch = useCallback((ops: PatchOp[]) => {
    if (!prevStateRef.current) return;

    isRemoteUpdate.current = true;
    try {
      const patched = applyPatch(
        { elements: prevStateRef.current.elements, appState: prevStateRef.current.appState },
        ops as Operation[],
        false,
        false,
      ).newDocument;

      prevStateRef.current = patched as typeof prevStateRef.current;
      apiRef.current?.updateScene({
        elements: patched.elements as readonly ExcalidrawElement[],
      });
    } finally {
      isRemoteUpdate.current = false;
    }
  }, []);

  const onError = useCallback((code: string) => {
    if (code === 'DIAGRAM_DELETED') {
      alert('This diagram has been deleted.');
      window.history.back();
    }
  }, []);

  const { sendPatch } = useDiagramWs({ diagramId, onInit, onPatch, onError, onStatusChange });

  const onChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) => {
    if (isRemoteUpdate.current) return;

    const prev = prevStateRef.current;
    const next = { elements, appState };

    if (!prev) {
      prevStateRef.current = next;
      return;
    }

    const ops = compare(
      { elements: prev.elements, appState: prev.appState },
      { elements, appState },
    );

    if (ops.length === 0) return;

    prevStateRef.current = next;
    sendPatch(ops as PatchOp[]);
  }, [sendPatch]);

  useEffect(() => {
    if (initialSnapshot) loadSnapshot(initialSnapshot);
  }, [initialSnapshot, loadSnapshot]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        onChange={onChange}
      />
    </div>
  );
}
