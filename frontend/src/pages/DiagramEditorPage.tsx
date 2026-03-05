import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Diagram } from '../types/Diagram';
import { diagramApi } from '../api/diagramApi';
import { ExcalidrawEditor } from '../components/editors/ExcalidrawEditor';
import { DrawioEditor } from '../components/editors/DrawioEditor';
import type { WsStatus } from '../hooks/useDiagramWs';

export function DiagramEditorPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();

  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

  useEffect(() => {
    if (!id) return;
    diagramApi.getById(id)
      .then(setDiagram)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={styles.center}>Loading...</div>;
  if (error)   return <div style={styles.center}>{error}</div>;
  if (!diagram) return null;

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
        <div style={styles.titleGroup}>
          <span style={styles.title}>{diagram.title}</span>
          {diagram.description && <span style={styles.desc}>{diagram.description}</span>}
        </div>
        <WsStatusBadge status={wsStatus} />
      </div>

      <div style={styles.canvas}>
        {diagram.type === 'excalidraw' ? (
          <ExcalidrawEditor
            diagramId={diagram.id}
            initialSnapshot={diagram.snapshot}
            onStatusChange={setWsStatus}
          />
        ) : (
          <DrawioEditor
            diagramId={diagram.id}
            initialSnapshot={diagram.snapshot}
            onStatusChange={setWsStatus}
          />
        )}
      </div>
    </div>
  );
}

function WsStatusBadge({ status }: { status: WsStatus }) {
  const map: Record<WsStatus, [string, string]> = {
    connecting: ['#e3b341', 'Connecting…'],
    open:       ['#3fb950', 'Live'],
    closed:     ['#7d8590', 'Disconnected'],
    error:      ['#f85149', 'Error'],
  };
  const [color, label] = map[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' },
  topBar:     { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', borderBottom: '1px solid #30363d', background: '#161b22', flexShrink: 0 },
  backBtn:    { background: 'transparent', border: '1px solid #30363d', color: '#7d8590', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  titleGroup: { flex: 1, display: 'flex', alignItems: 'baseline', gap: 10 },
  title:      { fontWeight: 700, fontSize: 15 },
  desc:       { fontSize: 12, color: '#7d8590' },
  canvas:     { flex: 1, overflow: 'hidden' },
  center:     { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#7d8590', fontFamily: 'system-ui, sans-serif' },
};
