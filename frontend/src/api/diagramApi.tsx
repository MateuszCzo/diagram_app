import type { Diagram, CreateDiagramDto, UpdateDiagramDto } from '../types/Diagram';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const diagramApi = {
  list:       ():                          Promise<Diagram[]> => request('/diagrams'),
  getById:    (id: string):                Promise<Diagram>   => request(`/diagrams/${id}`),
  create:     (dto: CreateDiagramDto):     Promise<Diagram>   => request('/diagrams', { method: 'POST', body: JSON.stringify(dto) }),
  updateMeta: (id: string, dto: UpdateDiagramDto): Promise<Diagram> => request(`/diagrams/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  delete:     (id: string):               Promise<void>      => request(`/diagrams/${id}`, { method: 'DELETE' }),
};