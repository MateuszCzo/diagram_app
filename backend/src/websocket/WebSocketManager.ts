import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { ProjectCacheService } from './ProjectCacheService';
import { DiagramRepository } from '../diagram/diagram.repository';
import { FlushScheduler } from './FlushScheduler';

type ClientMessage =
  | { type: 'DIAGRAM_PATCH'; ops: unknown[] };

type ServerMessage =
  | { type: 'DIAGRAM_INIT';  snapshot: string; pendingPatches: unknown[][] }
  | { type: 'DIAGRAM_PATCH'; ops: unknown[] }
  | { type: 'ERROR';         code: string; message: string };

interface Room {
  sockets: Set<WebSocket>;
}

export class WebSocketManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly cacheService: ProjectCacheService,
    private readonly diagramRepo:  DiagramRepository,
    private readonly flushScheduler: FlushScheduler,
  ) {}

  setup(server: Server): void {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const diagramId = this.parseDiagramId(req.url ?? '');

      if (!diagramId) {
        this.send(ws, { type: 'ERROR', code: 'INVALID_URL', message: 'Expected /ws/:diagramId' });
        ws.close();
        return;
      }

      console.log(`[WS] client connected → diagram ${diagramId}`);
      this.joinRoom(ws, diagramId);

      ws.on('message', (raw) => {
        this.onMessage(ws, diagramId, raw.toString());
      });

      ws.on('close', () => {
        console.log(`[WS] client disconnected ← diagram ${diagramId}`);
        this.leaveRoom(ws, diagramId);
      });

      ws.on('error', (err) => {
        console.error(`[WS] socket error on diagram ${diagramId}:`, err);
      });
    });

    console.log('[WS] WebSocketServer attached');
  }

  private async joinRoom(ws: WebSocket, diagramId: string): Promise<void> {
    if (!this.rooms.has(diagramId)) {
      this.rooms.set(diagramId, { sockets: new Set() });
    }
    this.rooms.get(diagramId)!.sockets.add(ws);

    if (!this.cacheService.has(diagramId)) {
      const diagram = await this.diagramRepo.findById(diagramId);

      if (!diagram) {
        this.send(ws, { type: 'ERROR', code: 'NOT_FOUND', message: `Diagram ${diagramId} not found` });
        ws.close();
        this.rooms.get(diagramId)?.sockets.delete(ws);
        return;
      }

      this.cacheService.loadFromDb(diagramId, diagram.snapshot, diagram.type);
    }

    this.send(ws, {
      type:           'DIAGRAM_INIT',
      snapshot:       this.cacheService.getBaseSnapshot(diagramId)!,
      pendingPatches: this.cacheService.getPendingPatches(diagramId),
    });
  }

  private async leaveRoom(ws: WebSocket, diagramId: string): Promise<void> {
    const room = this.rooms.get(diagramId);
    if (!room) return;

    room.sockets.delete(ws);

    if (room.sockets.size === 0) {
      console.log(`[WS] room ${diagramId} empty — flushing and evicting`);
      await this.flushScheduler.flushDiagram(diagramId);
      this.cacheService.evict(diagramId);
      this.rooms.delete(diagramId);
    }
  }

  async flushAndCloseRoom(diagramId: string): Promise<void> {
    await this.flushScheduler.flushDiagram(diagramId);

    const room = this.rooms.get(diagramId);
    if (room) {
      this.broadcastToRoom(diagramId, {
        type:    'ERROR',
        code:    'DIAGRAM_DELETED',
        message: 'This diagram has been deleted',
      });

      for (const ws of room.sockets) {
        ws.close();
      }

      this.rooms.delete(diagramId);
    }

    this.cacheService.evict(diagramId);
  }

  private onMessage(ws: WebSocket, diagramId: string, raw: string): void {
    let msg: ClientMessage;

    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(ws, { type: 'ERROR', code: 'INVALID_JSON', message: 'Could not parse message' });
      return;
    }

    switch (msg.type) {
      case 'DIAGRAM_PATCH':
        this.handlePatch(ws, diagramId, msg.ops);
        break;
      default:
        this.send(ws, { type: 'ERROR', code: 'UNKNOWN_TYPE', message: `Unknown message type` });
    }
  }

  private handlePatch(ws: WebSocket, diagramId: string, ops: unknown[]): void {
    if (!Array.isArray(ops) || ops.length === 0) {
      this.send(ws, { type: 'ERROR', code: 'INVALID_PATCH', message: 'ops must be a non-empty array' });
      return;
    }

    if (!this.cacheService.has(diagramId)) {
      this.send(ws, { type: 'ERROR', code: 'NOT_FOUND', message: `Diagram ${diagramId} not in cache` });
      return;
    }

    this.cacheService.pushPatch(diagramId, ops);

    this.broadcastToRoom(diagramId, { type: 'DIAGRAM_PATCH', ops }, ws);
  }

  private broadcastToRoom(diagramId: string, msg: ServerMessage, exclude?: WebSocket): void {
    const room = this.rooms.get(diagramId);
    if (!room) return;

    const payload = JSON.stringify(msg);
    for (const client of room.sockets) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private parseDiagramId(url: string): string | null {
    const match = url.match(/^\/ws\/([^/?]+)/);
    return match?.[1] ?? null;
  }
}