import { useEffect, useRef, useCallback, useState } from 'react';
import { useDiagramWs } from '../../hooks/UseDiagramWs';
import type { PatchOp, XmlReplaceOp } from '../../types/Diagram';

interface DrawioViewerProps {
  diagramId:       string;
  initialSnapshot: string;
}

function buildViewerUrl(xml: string): string {
  const encoded = encodeURIComponent(xml);
  return `https://viewer.diagrams.net/?lightbox=1&highlight=0000ff&nav=1&dark=auto#R${encoded}`;
}

export function DrawioViewer({ diagramId, initialSnapshot }: DrawioViewerProps) {
  const [viewerUrl, setViewerUrl] = useState(() => buildViewerUrl(initialSnapshot));
  const currentXml = useRef<string>(initialSnapshot);

  const updateViewer = useCallback((xml: string) => {
    currentXml.current = xml;
    setViewerUrl(buildViewerUrl(xml));
  }, []);

  const onInit = useCallback((snapshot: string, pendingPatches: PatchOp[][]) => {
    let xml = snapshot;
    for (const ops of pendingPatches) {
      const last = ops[ops.length - 1] as XmlReplaceOp | undefined;
      if (last?.value) xml = last.value;
    }
    updateViewer(xml);
  }, [updateViewer]);

  const onPatch = useCallback((ops: PatchOp[]) => {
    const last = ops[ops.length - 1] as XmlReplaceOp | undefined;
    if (!last?.value) return;
    updateViewer(last.value);
  }, [updateViewer]);

  useDiagramWs({ diagramId, onInit, onPatch });

  useEffect(() => {
    if (initialSnapshot) updateViewer(initialSnapshot);
  }, [initialSnapshot, updateViewer]);

  return (
    <iframe
      key={viewerUrl}
      src={viewerUrl}
      style={{ width: '100%', height: 'auto' }}
      title="draw.io viewer"
    />
  );
}
