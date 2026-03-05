import { Operation } from 'fast-json-patch';
import { DiagramType } from '../diagram/diagram.entity';

export interface ProjectCacheEntry {
  diagramId:      string;
  diagramType:    DiagramType;
  baseSnapshot:   string;
  pendingPatches: unknown[][];
  isDirty:        boolean;
  lastModified:   number;
  lastFlushed:    number;
}

export class ProjectCacheService {
  private readonly cache = new Map<string, ProjectCacheEntry>();

  has(diagramId: string): boolean {
    return this.cache.has(diagramId);
  }

  getBaseSnapshot(diagramId: string): string | null {
    return this.cache.get(diagramId)?.baseSnapshot ?? null;
  }

  getPendingPatches(diagramId: string): unknown[][] {
    return this.cache.get(diagramId)?.pendingPatches ?? [];
  }

  getDirtyEntries(): ProjectCacheEntry[] {
    return [...this.cache.values()].filter((e) => e.isDirty);
  }

  loadFromDb(diagramId: string, snapshot: string, diagramType: DiagramType): void {
    this.cache.set(diagramId, {
      diagramId,
      diagramType,
      baseSnapshot:   snapshot,
      pendingPatches: [],
      isDirty:        false,
      lastModified:   Date.now(),
      lastFlushed:    Date.now(),
    });
  }

  pushPatch(diagramId: string, ops: unknown[]): void {
    const entry = this.cache.get(diagramId);
    if (!entry) {
      console.warn(`[Cache] pushPatch called for unknown diagramId: ${diagramId}`);
      return;
    }
    entry.pendingPatches.push(ops);
    entry.isDirty      = true;
    entry.lastModified = Date.now();
  }

  commitFlush(diagramId: string, newSnapshot: string): void {
    const entry = this.cache.get(diagramId);
    if (!entry) return;

    entry.baseSnapshot   = newSnapshot;
    entry.pendingPatches = [];
    entry.isDirty        = false;
    entry.lastFlushed    = Date.now();
  }

  evict(diagramId: string): void {
    this.cache.delete(diagramId);
  }
}