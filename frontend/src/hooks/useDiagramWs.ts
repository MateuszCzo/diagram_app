import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerMessage, ClientMessage, PatchOp } from '../types/Diagram';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseDiagramWsOptions {
  diagramId: string;
  onInit:  (snapshot: string, pendingPatches: PatchOp[][]) => void;
  onPatch: (ops: PatchOp[]) => void;
  onError?: (code: string, message: string) => void;
  onStatusChange?: (status: WsStatus) => void;
}

interface UseDiagramWsReturn {
  status:     WsStatus;
  sendPatch:  (ops: PatchOp[]) => void;
}

export function useDiagramWs({
  diagramId,
  onInit,
  onPatch,
  onError,
  onStatusChange,
}: UseDiagramWsOptions): UseDiagramWsReturn {
  const wsRef        = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('connecting');

  const updateStatus = useCallback((s: WsStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  const onInitRef  = useRef(onInit);
  const onPatchRef = useRef(onPatch);
  const onErrorRef = useRef(onError);
  useEffect(() => { onInitRef.current  = onInit;  }, [onInit]);
  useEffect(() => { onPatchRef.current = onPatch; }, [onPatch]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${diagramId}`);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen  = () => updateStatus('open');
    ws.onerror = () => updateStatus('error');
    ws.onclose = () => updateStatus('closed');
    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        console.error('[WS] Failed to parse message:', event.data);
        return;
      }

      switch (msg.type) {
        case 'DIAGRAM_INIT':
          onInitRef.current(msg.snapshot, msg.pendingPatches);
          break;
        case 'DIAGRAM_PATCH':
          onPatchRef.current(msg.ops);
          break;
        case 'ERROR':
          console.error(`[WS] Server error ${msg.code}:`, msg.message);
          onErrorRef.current?.(msg.code, msg.message);
          break;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [diagramId]);

  const sendPatch = useCallback((ops: PatchOp[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] sendPatch called but socket is not open');
      return;
    }
    const msg: ClientMessage = { type: 'DIAGRAM_PATCH', ops };
    ws.send(JSON.stringify(msg));
  }, []);

  return { status, sendPatch };
}
