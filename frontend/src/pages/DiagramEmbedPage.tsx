import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { diagramApi } from '../api/diagramApi';
import { ExcalidrawViewer } from '../components/viewers/ExcalidrawViewer';
import { DrawioViewer } from '../components/viewers/DrawioViewer';
import type { Diagram } from '../types/Diagram';

export function DiagramEmbedPage() {
  const { id } = useParams<{ id: string }>();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    diagramApi.getById(id)
      .then(setDiagram)
      .catch(() => setError('Diagram not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={styles.center}>Loading...</div>;
  if (error || !diagram) return <div style={styles.center}>{error ?? 'Diagram not found'}</div>;

  return (
    <div style={styles.page}>
      {diagram.type === 'excalidraw' ? (
        <ExcalidrawViewer
          diagramId={diagram.id}
          initialSnapshot={diagram.snapshot}
        />
      ) : (
        <DrawioViewer
          diagramId={diagram.id}
          initialSnapshot={diagram.snapshot}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:   { width: '100%', height: 'auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'auto', color: '#7d8590', fontFamily: 'system-ui, sans-serif' },
};
