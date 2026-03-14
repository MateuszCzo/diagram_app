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
    const result = this.cache.has(diagramId);
    console.log(`[Cache] has(${diagramId}) → ${result}`);
    return result;
  }

  getBaseSnapshot(diagramId: string): string | null {
    const snapshot = this.cache.get(diagramId)?.baseSnapshot ?? null;
    console.log(`[Cache] getBaseSnapshot(${diagramId}) → length: ${snapshot?.length ?? 'null'}`);
    return snapshot;
  }

  getPendingPatches(diagramId: string): unknown[][] {
    const patches = this.cache.get(diagramId)?.pendingPatches ?? [];
    console.log(`[Cache] getPendingPatches(${diagramId}) → ${patches.length} batches`);
    return patches;
  }

  getDirtyEntries(): ProjectCacheEntry[] {
    const dirty = [...this.cache.values()].filter((e) => e.isDirty);
    return dirty;
  }

  loadFromDb(diagramId: string, snapshot: string, diagramType: DiagramType): void {
    console.log(`[Cache] loadFromDb(${diagramId}) — type: ${diagramType}, snapshot length: ${snapshot.length}`);
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
    console.log(`[Cache] pushPatch(${diagramId}) — ops: ${ops.length}, totalBatches: ${entry.pendingPatches.length}`);
  }

  commitFlush(diagramId: string, newSnapshot: string): void {
    const entry = this.cache.get(diagramId);
    if (!entry) {
      console.warn(`[Cache] commitFlush(${diagramId}) — entry not found`);
      return;
    }
    entry.baseSnapshot   = newSnapshot;
    entry.pendingPatches = [];
    entry.isDirty        = false;
    entry.lastFlushed    = Date.now();
    console.log(`[Cache] commitFlush(${diagramId}) — newSnapshot length: ${newSnapshot.length}`);
  }

  evict(diagramId: string): void {
    console.log(`[Cache] evict(${diagramId})`);
    this.cache.delete(diagramId);
  }
}