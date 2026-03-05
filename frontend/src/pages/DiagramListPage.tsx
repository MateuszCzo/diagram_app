import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Diagram, DiagramType, CreateDiagramDto, UpdateDiagramDto } from '../types/Diagram';
import { diagramApi } from '../api/diagramApi';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <button style={styles.iconBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DiagramListPage() {
  const navigate = useNavigate();

  const [diagrams,  setDiagrams]  = useState<Diagram[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createDto,  setCreateDto]  = useState<CreateDiagramDto>({ title: '', type: 'excalidraw' });

  const [editTarget, setEditTarget] = useState<Diagram | null>(null);
  const [editDto,    setEditDto]    = useState<UpdateDiagramDto>({});


  useEffect(() => {
    fetchDiagrams();
  }, []);

  async function fetchDiagrams() {
    try {
      setLoading(true);
      setDiagrams(await diagramApi.list());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load diagrams');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!createDto.title.trim()) return;
    try {
      const diagram = await diagramApi.create(createDto);
      setDiagrams((prev) => [diagram, ...prev]);
      setShowCreate(false);
      setCreateDto({ title: '', type: 'excalidraw' });
      navigate(`/diagrams/${diagram.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create diagram');
    }
  }

  async function handleUpdate() {
    if (!editTarget) return;
    try {
      const updated = await diagramApi.updateMeta(editTarget.id, editDto);
      setDiagrams((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setEditTarget(null);
      setEditDto({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update diagram');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this diagram? This action cannot be undone.')) return;
    try {
      await diagramApi.delete(id);
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete diagram');
    }
  }

  function openEdit(diagram: Diagram) {
    setEditTarget(diagram);
    setEditDto({ title: diagram.title, description: diagram.description ?? '' });
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.heading}>Diagrams</h1>
        <button style={styles.primaryBtn} onClick={() => setShowCreate(true)}>+ New diagram</button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button style={styles.iconBtn} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#7d8590' }}>Loading...</p>
      ) : diagrams.length === 0 ? (
        <p style={{ color: '#7d8590' }}>No diagrams yet. Create one to get started.</p>
      ) : (
        <div style={styles.grid}>
          {diagrams.map((d) => (
            <div key={d.id} style={styles.card} onClick={() => navigate(`/diagrams/${d.id}`)}>
              <div style={styles.cardTop}>
                <span style={{ ...styles.typeBadge, ...(d.type === 'drawio' ? styles.badgeDrawio : styles.badgeExcalidraw) }}>
                  {d.type}
                </span>
                <div style={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                  <button style={styles.iconBtn} title="Edit" onClick={() => openEdit(d)}>✎</button>
                  <button style={{ ...styles.iconBtn, color: '#f85149' }} title="Delete" onClick={() => handleDelete(d.id)}>🗑</button>
                </div>
              </div>
              <div style={styles.cardTitle}>{d.title}</div>
              {d.description && <div style={styles.cardDesc}>{d.description}</div>}
              <div style={styles.cardDate}>{new Date(d.updatedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New diagram" onClose={() => setShowCreate(false)}>
          <div style={styles.form}>
            <label style={styles.label}>Title *</label>
            <input
              style={styles.input}
              value={createDto.title}
              onChange={(e) => setCreateDto((p) => ({ ...p, title: e.target.value }))}
              placeholder="My diagram"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <label style={styles.label}>Type</label>
            <select
              style={styles.input}
              value={createDto.type}
              onChange={(e) => setCreateDto((p) => ({ ...p, type: e.target.value as DiagramType }))}
            >
              <option value="excalidraw">Excalidraw</option>
              <option value="drawio">draw.io</option>
            </select>
            <label style={styles.label}>Description</label>
            <input
              style={styles.input}
              value={createDto.description ?? ''}
              onChange={(e) => setCreateDto((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
            />
            <div style={styles.modalFooter}>
              <button style={styles.ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={handleCreate} disabled={!createDto.title.trim()}>Create</button>
            </div>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal title="Edit diagram" onClose={() => setEditTarget(null)}>
          <div style={styles.form}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              value={editDto.title ?? ''}
              onChange={(e) => setEditDto((p) => ({ ...p, title: e.target.value }))}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            />
            <label style={styles.label}>Description</label>
            <input
              style={styles.input}
              value={editDto.description ?? ''}
              onChange={(e) => setEditDto((p) => ({ ...p, description: e.target.value }))}
            />
            <div style={styles.modalFooter}>
              <button style={styles.ghostBtn} onClick={() => setEditTarget(null)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={handleUpdate}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:       { maxWidth: 1100, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif', color: '#e6edf3', minHeight: '100vh', background: '#0d1117' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  heading:    { margin: 0, fontSize: 22, fontWeight: 800 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 },
  card:       { background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 6 },
  cardTop:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:  { fontWeight: 700, fontSize: 14 },
  cardDesc:   { fontSize: 12, color: '#7d8590', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardDate:   { fontSize: 11, color: '#484f58', marginTop: 4 },
  cardActions:{ display: 'flex', gap: 4 },
  typeBadge:  { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, letterSpacing: '0.06em', textTransform: 'uppercase' },
  badgeExcalidraw: { background: '#1f3a5f', color: '#388bfd', border: '1px solid #388bfd33' },
  badgeDrawio:     { background: '#1a3a2a', color: '#3fb950', border: '1px solid #3fb95033' },
  primaryBtn: { background: '#388bfd', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  ghostBtn:   { background: 'transparent', color: '#7d8590', border: '1px solid #30363d', borderRadius: 6, padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  iconBtn:    { background: 'transparent', border: 'none', cursor: 'pointer', color: '#7d8590', fontSize: 14, padding: '2px 6px', borderRadius: 4 },
  overlay:    { position: 'fixed', inset: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:      { background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' },
  modalHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalFooter:{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  form:       { display: 'flex', flexDirection: 'column', gap: 8 },
  label:      { fontSize: 12, color: '#7d8590', fontWeight: 600 },
  input:      { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  errorBanner:{ background: '#3d1a1a', border: '1px solid #f8514933', color: '#f85149', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
};
