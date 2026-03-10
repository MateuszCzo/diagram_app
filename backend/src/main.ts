import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { AppDataSource } from './config/database';
import { diagramRouter } from './diagram/diagram.router';
import { WebSocketManager } from './websocket/WebSocketManager';
import { ProjectCacheService } from './websocket/ProjectCacheService';
import { FlushScheduler } from './websocket/FlushScheduler';
import { DiagramRepository } from './diagram/diagram.repository';
import { DiagramService } from './diagram/diagram.service';

async function bootstrap() {
  const maxAttempts = 30;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await AppDataSource.initialize();
      console.log("✅ Database connected");
      break;
    } catch (err) {
      if (i === maxAttempts - 1) {
        console.error("❌ Cannot connect to database after 30s");
        throw err;
      }
      console.log(`⏳ DB not ready... retry ${i + 1}/${maxAttempts}`);
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  const diagramRepository = new DiagramRepository(AppDataSource);
  const cacheService      = new ProjectCacheService();
  const flushScheduler    = new FlushScheduler(cacheService, diagramRepository);
  const wsManager         = new WebSocketManager(cacheService, diagramRepository, flushScheduler);
  const diagramService    = new DiagramService(diagramRepository, cacheService, wsManager);

  const app    = express();
  const server = createServer(app);

  app.use(cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  }));
  app.use(express.json());

  app.use('/diagrams', diagramRouter(diagramService));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  wsManager.setup(server);

  flushScheduler.start();

  const PORT = Number(process.env.PORT ?? 8000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });

  async function shutdown(signal: string) {
    console.log(`\n${signal} received — shutting down gracefully`);

    flushScheduler.stop();
    await flushScheduler.flushAll();
    console.log('✅ Final flush complete');

    await AppDataSource.destroy();
    console.log('✅ Database connection closed');

    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️  Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
