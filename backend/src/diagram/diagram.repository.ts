import { DataSource } from 'typeorm';
import { Diagram } from './diagram.entity';
import { CreateDiagramDto, UpdateDiagramDto } from './diagram.service';

export class DiagramRepository {
  private readonly repo;

  constructor(private readonly dataSource: DataSource) {
    this.repo = dataSource.getRepository(Diagram);
  }

  findAll(): Promise<Diagram[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<Diagram | null> {
    return this.repo.findOne({ where: { id } });
  }

  create(dto: Required<CreateDiagramDto>): Promise<Diagram> {
    const diagram = this.repo.create({
      title:       dto.title,
      description: dto.description,
      type:        dto.type,
      snapshot:    dto.snapshot ?? '',
      createdAt:   new Date(),
      updatedAt:   new Date()
    });
    return this.repo.save(diagram);
  }

  async updateMeta(id: string, dto: UpdateDiagramDto): Promise<Diagram | null> {
    const diagram = await this.findById(id);
    if (!diagram) return null;

    if (dto.title       !== undefined) diagram.title       = dto.title;
    if (dto.description !== undefined) diagram.description = dto.description ?? null;

    return this.repo.save(diagram);
  }

  async upsertSnapshot(id: string, snapshot: string): Promise<void> {
    await this.repo.update(id, { snapshot, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}