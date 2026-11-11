import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createAuthRouter } from './routes/auth.js';
import { createChatRouter } from './routes/chats.js';
import { createUserRouter } from './routes/users.js';
import { errorHandler } from './utils/http.js';

/** Builds the Express app. Does not listen or connect to anything, so tests can use it directly. */
export const createApp = (config) => {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime(), environment: config.env });
  });

  app.use('/api/auth', createAuthRouter(config));
  app.use('/api/users', createUserRouter(config));
  app.use('/api/chats', createChatRouter(config));

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  app.use(errorHandler);

  return app;
};

export default createApp;
