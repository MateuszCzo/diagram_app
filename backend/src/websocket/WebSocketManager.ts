import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { ProjectCacheService } from './ProjectCacheService';
import { DiagramRepository } from '../diagram/diagram.repository';
import { FlushScheduler } from './FlushScheduler';
import { isValidUuid } from '../diagram/diagram.service';

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
      const rawUrl    = req.url ?? '';
      const diagramId = this.parseDiagramId(rawUrl);
      console.log(`[WS] connection — url: "${rawUrl}", parsedId: "${diagramId}"`);

      if (!diagramId) {
        console.warn(`[WS] connection rejected — invalid URL: ${rawUrl}`);
        this.send(ws, { type: 'ERROR', code: 'INVALID_URL', message: 'Expected /ws/:diagramId' });
        ws.close();
        return;
      }

      const valid = isValidUuid(diagramId);
      console.log(`[WS] isValidUuid("${diagramId}") → ${valid}`);
      if (!valid) {
        console.warn(`[WS] connection rejected — invalid uuid: ${diagramId}`);
        this.send(ws, { type: 'ERROR', code: 'INVALID_REQUEST', message: 'Expected :diagramId as uuid' });
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
    console.log(`[WS] joinRoom ${diagramId} — room size: ${this.rooms.get(diagramId)!.sockets.size}`);

    if (!this.cacheService.has(diagramId)) {
      console.log(`[WS] cache miss for ${diagramId} — loading from DB`);
      const diagram = await this.diagramRepo.findById(diagramId);

      if (!diagram) {
        console.warn(`[WS] diagram ${diagramId} not found in DB`);
        this.send(ws, { type: 'ERROR', code: 'NOT_FOUND', message: `Diagram ${diagramId} not found` });
        ws.close();
        this.rooms.get(diagramId)?.sockets.delete(ws);
        return;
      }

      console.log(`[WS] loaded from DB — snapshot length: ${diagram.snapshot.length}, type: ${diagram.type}`);
      this.cacheService.loadFromDb(diagramId, diagram.snapshot, diagram.type);
    } else {
      console.log(`[WS] cache hit for ${diagramId}`);
    }

    const snapshot       = this.cacheService.getBaseSnapshot(diagramId)!;
    const pendingPatches = this.cacheService.getPendingPatches(diagramId).filter((batch) => {
      if (batch.length === 1) {
        const op = batch[0] as { value?: string };
        if (op.value !== undefined) {
          try {
            const parsed = JSON.parse(op.value);
            if (Array.isArray(parsed) && parsed.length === 0) return false;
          } catch {}
          if (op.value === '' || op.value === '[]') return false;
        }
      }
      return true;
    });
    console.log(`[WS] sending DIAGRAM_INIT — snapshot length: ${snapshot.length}, pendingPatches: ${pendingPatches.length}`);

    this.send(ws, {
      type: 'DIAGRAM_INIT',
      snapshot,
      pendingPatches,
    });
  }

  private async leaveRoom(ws: WebSocket, diagramId: string): Promise<void> {
    const room = this.rooms.get(diagramId);
    if (!room) {
      console.warn(`[WS] leaveRoom(${diagramId}) — room not found`);
      return;
    }

    room.sockets.delete(ws);
    console.log(`[WS] leaveRoom(${diagramId}) — remaining sockets: ${room.sockets.size}`);

    if (room.sockets.size === 0) {
      console.log(`[WS] room ${diagramId} empty — flushing and evicting`);
      await this.flushScheduler.flushDiagram(diagramId);
      this.cacheService.evict(diagramId);
      this.rooms.delete(diagramId);
      console.log(`[WS] room ${diagramId} evicted`);
    }
  }

  async flushAndCloseRoom(diagramId: string): Promise<void> {
    console.log(`[WS] flushAndCloseRoom(${diagramId})`);
    await this.flushScheduler.flushDiagram(diagramId);

    const room = this.rooms.get(diagramId);
    if (room) {
      console.log(`[WS] closing ${room.sockets.size} sockets in room ${diagramId}`);
      this.broadcastToRoom(diagramId, {
        type:    'ERROR',
        code:    'DIAGRAM_DELETED',
        message: 'This diagram has been deleted',
      });
      for (const ws of room.sockets) {
        ws.close();
      }
      this.rooms.delete(diagramId);
    } else {
      console.log(`[WS] flushAndCloseRoom(${diagramId}) — no active room`);
    }

    this.cacheService.evict(diagramId);
  }

  private onMessage(ws: WebSocket, diagramId: string, raw: string): void {
    let msg: ClientMessage;

    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn(`[WS] onMessage(${diagramId}) — invalid JSON`);
      this.send(ws, { type: 'ERROR', code: 'INVALID_JSON', message: 'Could not parse message' });
      return;
    }

    console.log(`[WS] onMessage(${diagramId}) — type: ${msg.type}`);

    switch (msg.type) {
      case 'DIAGRAM_PATCH':
        this.handlePatch(ws, diagramId, msg.ops);
        break;
      default:
        console.warn(`[WS] onMessage(${diagramId}) — unknown type: ${(msg as ClientMessage).type}`);
        this.send(ws, { type: 'ERROR', code: 'UNKNOWN_TYPE', message: `Unknown message type` });
    }
  }

  private handlePatch(ws: WebSocket, diagramId: string, ops: unknown[]): void {
    if (!Array.isArray(ops) || ops.length === 0) {
      console.warn(`[WS] handlePatch(${diagramId}) — invalid ops`);
      this.send(ws, { type: 'ERROR', code: 'INVALID_PATCH', message: 'ops must be a non-empty array' });
      return;
    }

    if (!this.cacheService.has(diagramId)) {
      console.warn(`[WS] handlePatch(${diagramId}) — not in cache`);
      this.send(ws, { type: 'ERROR', code: 'NOT_FOUND', message: `Diagram ${diagramId} not in cache` });
      return;
    }

    console.log(`[WS] handlePatch(${diagramId}) — ops: ${ops.length}, sample: ${JSON.stringify(ops[0])}`);

    this.cacheService.pushPatch(diagramId, ops);

    const pending = this.cacheService.getPendingPatches(diagramId);
    console.log(`[WS] handlePatch(${diagramId}) — pendingPatches after push: ${pending.length}`);

    const room = this.rooms.get(diagramId);
    const roomSize = room?.sockets.size ?? 0;
    console.log(`[WS] broadcasting patch to room ${diagramId} — room size: ${roomSize}`);
    this.broadcastToRoom(diagramId, { type: 'DIAGRAM_PATCH', ops }, ws);
  }

  private broadcastToRoom(diagramId: string, msg: ServerMessage, exclude?: WebSocket): void {
    const room = this.rooms.get(diagramId);
    if (!room) return;

    const payload = JSON.stringify(msg);
    let sent = 0;
    for (const client of room.sockets) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    }
    console.log(`[WS] broadcastToRoom(${diagramId}) — sent to ${sent} clients`);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn(`[WS] send() — socket not open (readyState: ${ws.readyState})`);
    }
  }

  private parseDiagramId(url: string): string | null {
    const match = url.match(/^\/ws\/([^/?]+)/);
    return match?.[1] ?? null;
  }
}