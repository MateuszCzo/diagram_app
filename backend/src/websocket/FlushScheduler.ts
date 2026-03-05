import { ProjectCacheService, ProjectCacheEntry } from './ProjectCacheService';
import { DiagramRepository } from '../diagram/diagram.repository';
import { createPatchDriver } from './PatchDriver';

export class FlushScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;

  constructor(
    private readonly cacheService:  ProjectCacheService,
    private readonly diagramRepo:   DiagramRepository,
    intervalMs?: number,
  ) {
    this.intervalMs = intervalMs ?? Number(process.env.FLUSH_INTERVAL_MS ?? 5_000);
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.flushAll(), this.intervalMs);
    console.log(`[FlushScheduler] started — interval ${this.intervalMs}ms`);
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log('[FlushScheduler] stopped');
  }

  async flushAll(): Promise<void> {
    const dirty = this.cacheService.getDirtyEntries();
    if (dirty.length === 0) return;

    await Promise.allSettled(dirty.map((entry) => this.flushOne(entry)));
  }

  async flushOne(entry: ProjectCacheEntry): Promise<void> {
    if (!entry.isDirty || entry.pendingPatches.length === 0) return;

    try {
      const newSnapshot = this.applyPendingPatches(entry);
      await this.diagramRepo.upsertSnapshot(entry.diagramId, newSnapshot);
      this.cacheService.commitFlush(entry.diagramId, newSnapshot);

      console.log(`[FlushScheduler] flushed ${entry.diagramId} (${entry.pendingPatches.length} patch batches)`);
    } catch (err) {
      console.error(`[FlushScheduler] failed to flush ${entry.diagramId}:`, err);
    }
  }

  async flushDiagram(diagramId: string): Promise<void> {
    const dirty = this.cacheService.getDirtyEntries();
    const entry = dirty.find((e) => e.diagramId === diagramId);
    if (entry) await this.flushOne(entry);
  }

  private applyPendingPatches(entry: ProjectCacheEntry): string {
    if (entry.pendingPatches.length === 0) return entry.baseSnapshot;

    const driver = createPatchDriver(entry.diagramType);
    return driver.apply(entry.baseSnapshot, entry.pendingPatches);
  }
}