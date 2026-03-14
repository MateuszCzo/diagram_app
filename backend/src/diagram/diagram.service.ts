import { Diagram, DiagramType } from './diagram.entity';
import { DiagramRepository } from './diagram.repository';
import { ProjectCacheService } from '../websocket/ProjectCacheService';
import { WebSocketManager } from '../websocket/WebSocketManager';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateDiagramDto {
  title: string;
  description?: string | null;
  type: DiagramType;
  snapshot?: string | null;
}

export interface UpdateDiagramDto {
  title?: string;
  description?: string;
}

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export class DiagramService {
  constructor(
    private readonly diagramRepository: DiagramRepository,
    private readonly cacheService: ProjectCacheService,
    private readonly wsManager: WebSocketManager,
  ) {}

  list(): Promise<Diagram[]> {
    console.log('[DiagramService] list()');
    return this.diagramRepository.findAll();
  }

  getById(id: string): Promise<Diagram | null> {
    console.log(`[DiagramService] getById(${id})`);
    return this.diagramRepository.findById(id);
  }

  create(dto: CreateDiagramDto): Promise<Diagram> {
    console.log(`[DiagramService] create() — title: "${dto.title}", type: ${dto.type}`);
    return this.diagramRepository.create({
      title:       dto.title,
      description: dto.description ?? null,
      type:        dto.type,
      snapshot:    dto.snapshot ?? '',
    });
  }

  updateMeta(id: string, dto: UpdateDiagramDto): Promise<Diagram | null> {
    console.log(`[DiagramService] updateMeta(${id}) — dto:`, dto);
    return this.diagramRepository.updateMeta(id, dto);
  }

  async delete(id: string): Promise<boolean> {
    console.log(`[DiagramService] delete(${id})`);
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) {
      console.warn(`[DiagramService] delete(${id}) — not found`);
      return false;
    }
    console.log(`[DiagramService] delete(${id}) — flushing WS room`);
    await this.wsManager.flushAndCloseRoom(id);
    console.log(`[DiagramService] delete(${id}) — deleting from DB`);
    await this.diagramRepository.delete(id);
    console.log(`[DiagramService] delete(${id}) — done`);
    return true;
  }

  async getSnapshot(id: string): Promise<string | null> {
    console.log(`[DiagramService] getSnapshot(${id})`);
    const cached = this.cacheService.getBaseSnapshot(id);
    if (cached !== null) {
      console.log(`[DiagramService] getSnapshot(${id}) — cache hit, length: ${cached.length}`);
      return cached;
    }
    console.log(`[DiagramService] getSnapshot(${id}) — cache miss, loading from DB`);
    const diagram = await this.diagramRepository.findById(id);
    const snapshot = diagram?.snapshot ?? null;
    console.log(`[DiagramService] getSnapshot(${id}) — snapshot length: ${snapshot?.length ?? 'null'}`);
    return snapshot;
  }
}