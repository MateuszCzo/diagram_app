import { WebSocketServer, WebSocket } from 'ws';
import { DataSource } from 'typeorm';
import { Project } from './models/Project';
import { IncomingMessage } from 'http';

interface ProjectData {
  elements: any[];
}

const rooms = new Map<string, Set<WebSocket>>();
const projectCache = new Map<string, ProjectData>();

export function setupWebSocket(server: any, dataSource: DataSource) {
  const wss = new WebSocketServer({ server });
  const projectRepo = dataSource.getRepository(Project);

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    console.log('✅ WebSocket client connected');

    const url = req.url || '';
    const match = url.match(/\/ws\/(.+)/);
    if (!match) {
      ws.close();
      return;
    }

    const projectId = match[1];

    if (!rooms.has(projectId)) {
      rooms.set(projectId, new Set());
    }
    rooms.get(projectId)!.add(ws);

    console.log(`Client joined project ${projectId}`);

    if (!projectCache.has(projectId)) {
      const project = await projectRepo.findOne({ where: { id: projectId } });
      projectCache.set(
        projectId,
        project?.snapshot
          ? JSON.parse(project.snapshot)
          : { elements: [] }
      );
    }

    ws.send(JSON.stringify(projectCache.get(projectId)));

    ws.on('message', async (raw) => {
      const payload = JSON.parse(raw.toString());

      if (!Array.isArray(payload.elements)) return;

      projectCache.set(projectId, payload);

      for (const client of rooms.get(projectId)!) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payload));
        }
      }

      await projectRepo.upsert(
        { id: projectId, name: projectId, snapshot: JSON.stringify(payload) },
        ['id']
      );
    });

    ws.on('close', () => {
      rooms.get(projectId)?.delete(ws);
      console.log(`Client left project ${projectId}`);
    });
  });
}
