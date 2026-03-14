import { useEffect, useRef, useCallback } from 'react';
import { useDiagramWs, type WsStatus } from '../../hooks/UseDiagramWs';
import type { PatchOp, XmlReplaceOp } from '../../types/Diagram';

interface DrawioEditorProps {
  diagramId:       string;
  initialSnapshot: string;
  onStatusChange?: (status: WsStatus) => void;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1';

type DrawioEvent =
  | { event: 'init' }
  | { event: 'load'; xml: string }
  | { event: 'save'; xml: string }
  | { event: 'change'; changes: unknown }
  | { event: 'autosave'; xml: string };

export function DrawioEditor({ diagramId, initialSnapshot, onStatusChange }: DrawioEditorProps) {
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const isReadyRef     = useRef(false);
  const isRemoteUpdate = useRef(false);
  const currentXml     = useRef<string>(initialSnapshot);

  const sendToDrawio = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
  }, []);

  const loadXml = useCallback((xml: string) => {
    currentXml.current = xml;
    sendToDrawio({ action: 'load', xml, autosave: 1 });
  }, [sendToDrawio]);

  const onInit = useCallback((snapshot: string, pendingPatches: PatchOp[][]) => {
    let xml = snapshot;
    for (const ops of pendingPatches) {
      const last = ops[ops.length - 1] as XmlReplaceOp | undefined;
      if (last?.value) xml = last.value;
    }
    if (isReadyRef.current) loadXml(xml);
    else currentXml.current = xml;
  }, [loadXml]);

  const onPatch = useCallback((ops: PatchOp[]) => {
    const last = ops[ops.length - 1] as XmlReplaceOp | undefined;
    if (!last?.value) return;

    isRemoteUpdate.current = true;
    loadXml(last.value);
    setTimeout(() => { isRemoteUpdate.current = false; }, 50);
  }, [loadXml]);

  const onError = useCallback((code: string) => {
    if (code === 'DIAGRAM_DELETED') {
      alert('This diagram has been deleted.');
      window.history.back();
    }
  }, []);

  const { sendPatch } = useDiagramWs({ diagramId, onInit, onPatch, onError, onStatusChange });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      let msg: DrawioEvent;
      try {
        msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch { return; }

      switch (msg.event) {
        case 'init':
          isReadyRef.current = true;
          loadXml(currentXml.current);
          break;

        case 'autosave':
        case 'save': {
          if (isRemoteUpdate.current) break;

          const newXml = msg.xml;
          if (newXml === currentXml.current) break;

          currentXml.current = newXml;

          const ops: XmlReplaceOp[] = [{ value: newXml }];
          sendPatch(ops as PatchOp[]);
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadXml, sendPatch]);

  return (
    <iframe
      ref={iframeRef}
      src={DRAWIO_URL}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="draw.io editor"
    />
  );
}
