import { Router, Request, Response } from 'express';
import { DiagramService, isValidUuid } from './diagram.service';

export function diagramRouter(diagramService: DiagramService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    console.log('[HTTP] GET /diagrams');
    const diagrams = await diagramService.list();
    console.log(`[HTTP] GET /diagrams → ${diagrams.length} results`);
    res.json(diagrams);
  });

  router.get('/:id', async (req: Request, res: Response) => {
    console.log(`[HTTP] GET /diagrams/${req.params.id}`);
    if (!isValidUuid(req.params.id)) {
      console.warn(`[HTTP] GET /diagrams/${req.params.id} → 400 invalid uuid`);
      res.status(400).json({ message: 'Invalid diagram id' });
      return;
    }
    const diagram = await diagramService.getById(req.params.id);
    if (!diagram) {
      console.warn(`[HTTP] GET /diagrams/${req.params.id} → 404 not found`);
      res.status(404).json({ message: 'Diagram not found' });
      return;
    }
    console.log(`[HTTP] GET /diagrams/${req.params.id} → 200, snapshot length: ${diagram.snapshot.length}`);
    res.json(diagram);
  });

  router.post('/', async (req: Request, res: Response) => {
    console.log(`[HTTP] POST /diagrams — body:`, { title: req.body.title, type: req.body.type });
    const { title, description, type, snapshot } = req.body;

    if (!title || !type) {
      console.warn('[HTTP] POST /diagrams → 400 missing title or type');
      res.status(400).json({ message: 'title and type are required' });
      return;
    }

    const diagram = await diagramService.create({ title, description, type, snapshot });
    console.log(`[HTTP] POST /diagrams → 201, id: ${diagram.id}`);
    res.status(201).json(diagram);
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    console.log(`[HTTP] PATCH /diagrams/${req.params.id} — body:`, req.body);
    if (!isValidUuid(req.params.id)) {
      console.warn(`[HTTP] PATCH /diagrams/${req.params.id} → 400 invalid uuid`);
      res.status(400).json({ message: 'Invalid diagram id' });
      return;
    }
    const { title, description } = req.body;

    const diagram = await diagramService.updateMeta(req.params.id, { title, description });
    if (!diagram) {
      console.warn(`[HTTP] PATCH /diagrams/${req.params.id} → 404 not found`);
      res.status(404).json({ message: 'Diagram not found' });
      return;
    }
    console.log(`[HTTP] PATCH /diagrams/${req.params.id} → 200`);
    res.json(diagram);
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    console.log(`[HTTP] DELETE /diagrams/${req.params.id}`);
    if (!isValidUuid(req.params.id)) {
      console.warn(`[HTTP] DELETE /diagrams/${req.params.id} → 400 invalid uuid`);
      res.status(400).json({ message: 'Invalid diagram id' });
      return;
    }
    const deleted = await diagramService.delete(req.params.id);
    if (!deleted) {
      console.warn(`[HTTP] DELETE /diagrams/${req.params.id} → 404 not found`);
      res.status(404).json({ message: 'Diagram not found' });
      return;
    }
    console.log(`[HTTP] DELETE /diagrams/${req.params.id} → 204`);
    res.status(204).send();
  });

  return router;
}