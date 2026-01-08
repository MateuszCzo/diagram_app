import dotenv from 'dotenv'

dotenv.config()

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { setupWebSocket } from './websocketManager';
import { Database } from './config/databaseConfig';

const app = express();
const server = createServer(app);

app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["*"]
}));

async function startServer() {
  try {
    await Database.initialize();
    console.log("Database connection established");

    setupWebSocket(server, Database);

    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();