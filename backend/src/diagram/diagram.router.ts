import { Router, Request, Response } from 'express';
import { DiagramService } from './diagram.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function diagramRouter(diagramService: DiagramService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const diagrams = await diagramService.list();
    res.json(diagrams);
  });

  router.get('/:id', async (req: Request, res: Response) => {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({ message: 'Invalid diagram id' });
      return;
    }
    const diagram = await diagramService.getById(req.params.id);
    if (!diagram) {
      res.status(404).json({ message: 'Diagram not found' });
      return;
    }
    res.json(diagram);
  });

  router.post('/', async (req: Request, res: Response) => {
    const { title, description, type, snapshot } = req.body;

    if (!title || !type) {
      res.status(400).json({ message: 'title and type are required' });
      return;
    }

    const diagram = await diagramService.create({ title, description, type, snapshot });
    res.status(201).json(diagram);
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({ message: 'Invalid diagram id' });
      return;
    }
    const { title, description } = req.body;

    const diagram = await diagramService.updateMeta(req.params.id, { title, description });
    if (!diagram) {
      res.status(404).json({ message: 'Diagram not found' });
      return;
    }
    res.json(diagram);
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({ message: 'Invalid diagram id' });
      return;
    }
    const deleted = await diagramService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Diagram not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}