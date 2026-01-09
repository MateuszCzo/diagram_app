import { WebSocketServer, WebSocket } from 'ws';
import { DataSource } from 'typeorm';
import { Project } from './models/Project';
import { IncomingMessage } from 'http';

const rooms = new Map<string, Set<WebSocket>>();
const projectCache = new Map<string, string>();

export function setupWebSocket(server: any, dataSource: DataSource) {
  const wss = new WebSocketServer({ server });
  const projectRepo = dataSource.getRepository(Project);

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    console.log('✅ WebSocket client connected');

    const url = req.url || '';
    console.log(`Url ${url}`);

    const match = url.match(/\/ws\/(.+)/);
    if (!match) {
      console.log(`No match ws close`);
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
      console.log(`Pobieranie projektu z db`);
      const project = await projectRepo.findOne({ where: { id: projectId } });
      projectCache.set(
        projectId,
        project?.snapshot || ''
      );
    }

    const response = projectCache.get(projectId) || '';

    console.log(`Send project to client ${response}`);

    ws.send(response);

    ws.on('message', async (raw) => {
      console.log('Message recived');

      const payload = raw.toString();

      projectCache.set(projectId, payload);

      for (const client of rooms.get(projectId)!) {
        if (client !== ws 
          && client.readyState === WebSocket.OPEN
        ) {
          client.send(payload);
        }
      }

      await projectRepo.upsert(
        { id: projectId, name: projectId, snapshot: payload },
        ['id']
      );
    });

    ws.on('close', () => {
      rooms.get(projectId)?.delete(ws);
      console.log(`Client left project ${projectId}`);
    });
  });
}
