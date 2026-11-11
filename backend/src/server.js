import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { setupSocketHandlers } from './services/socketService.js';

/** Wires the Express app and Socket.io onto one HTTP server. Does not start listening. */
export const createServer = (config) => {
  const app = createApp(config);
  const server = createHttpServer(app);

  const io = new Server(server, {
    cors: { origin: config.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  });
  app.set('io', io);
  setupSocketHandlers(io);

  return { app, server, io };
};
