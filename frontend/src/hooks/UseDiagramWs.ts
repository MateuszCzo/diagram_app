import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerMessage, ClientMessage, PatchOp } from '../types/Diagram';

const WS_URL = import.meta.env.VITE_WS_URL;

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseDiagramWsOptions {
  diagramId: string;
  onInit:   (snapshot: string, pendingPatches: PatchOp[][]) => void;
  onPatch:  (ops: PatchOp[]) => void;
  onError?: (code: string, message: string) => void;
  onClose?: () => void;
  onStatusChange?: (status: WsStatus) => void;
}

interface UseDiagramWsReturn {
  status:    WsStatus;
  sendPatch: (ops: PatchOp[]) => void;
}

export function useDiagramWs({
  diagramId,
  onInit,
  onPatch,
  onError,
  onClose,
  onStatusChange,
}: UseDiagramWsOptions): UseDiagramWsReturn {
  const wsRef   = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('connecting');

  const activeRef = useRef(false);

  const updateStatus = useCallback((s: WsStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  const onInitRef  = useRef(onInit);
  const onPatchRef = useRef(onPatch);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onInitRef.current  = onInit;  }, [onInit]);
  useEffect(() => { onPatchRef.current = onPatch; }, [onPatch]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    activeRef.current = true;

    const ws = new WebSocket(`${WS_URL}/${diagramId}`);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (!activeRef.current) return;
      console.log(`[WS] connected — diagram: ${diagramId}`);
      updateStatus('open');
    };

    ws.onerror = (e) => {
      if (!activeRef.current) return;
      console.error('[WS] socket error:', e);
      updateStatus('error');
    };

    ws.onclose = () => {
      if (!activeRef.current) return;
      console.log(`[WS] disconnected — diagram: ${diagramId}`);
      onCloseRef.current?.();
      updateStatus('closed');
    };

    ws.onmessage = (event) => {
      if (!activeRef.current) return;

      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        console.error('[WS] Failed to parse message:', event.data);
        return;
      }

      console.log(`[WS] received: ${msg.type}`);

      switch (msg.type) {
        case 'DIAGRAM_INIT':
          console.log(`[WS] DIAGRAM_INIT — snapshot: ${msg.snapshot.length}, pending: ${msg.pendingPatches.length}`);
          onInitRef.current(msg.snapshot, msg.pendingPatches);
          break;
        case 'DIAGRAM_PATCH':
          console.log(`[WS] DIAGRAM_PATCH — ops: ${msg.ops.length}`);
          onPatchRef.current(msg.ops);
          break;
        case 'ERROR':
          console.error(`[WS] error ${msg.code}:`, msg.message);
          onErrorRef.current?.(msg.code, msg.message);
          break;
      }
    };

    return () => {
      activeRef.current = false;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      } else {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [diagramId]);

  const sendPatch = useCallback((ops: PatchOp[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] sendPatch — socket not open, dropping patch');
      return;
    }
    const msg: ClientMessage = { type: 'DIAGRAM_PATCH', ops };
    ws.send(JSON.stringify(msg));
  }, []);

  return { status, sendPatch };
}