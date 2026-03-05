import { Diagram, DiagramType } from './diagram.entity';
import { DiagramRepository } from './diagram.repository';
import { ProjectCacheService } from '../websocket/ProjectCacheService';
import { WebSocketManager } from '../websocket/WebSocketManager';

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

export class DiagramService {
  constructor(
    private readonly diagramRepository: DiagramRepository,
    private readonly cacheService: ProjectCacheService,
    private readonly wsManager: WebSocketManager,
  ) {}

  list(): Promise<Diagram[]> {
    return this.diagramRepository.findAll();
  }

  getById(id: string): Promise<Diagram | null> {
    return this.diagramRepository.findById(id);
  }

  create(dto: CreateDiagramDto): Promise<Diagram> {
    return this.diagramRepository.create({
      title:       dto.title,
      description: dto.description ?? null,
      type:        dto.type,
      snapshot:    dto.snapshot ?? '',
    });
  }

  updateMeta(id: string, dto: UpdateDiagramDto): Promise<Diagram | null> {
    return this.diagramRepository.updateMeta(id, dto);
  }

  async delete(id: string): Promise<boolean> {
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) return false;

    await this.wsManager.flushAndCloseRoom(id);

    await this.diagramRepository.delete(id);

    return true;
  }

  async getSnapshot(id: string): Promise<string | null> {
    const cached = this.cacheService.getBaseSnapshot(id);
    if (cached !== null) return cached;

    const diagram = await this.diagramRepository.findById(id);
    return diagram?.snapshot ?? null;
  }
}