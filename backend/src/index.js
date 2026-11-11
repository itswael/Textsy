import { getConfig } from './config/index.js';
import { closeMongoDB, connectMongoDB } from './config/database.js';
import { createServer } from './server.js';

const config = getConfig();

const start = async () => {
  await connectMongoDB(config.mongoUri);
  const { server, io } = createServer(config);

  server.listen(config.port, () => {
    console.log(`Textsy backend listening on :${config.port} (${config.env})`);
    if (config.inviteCodes.length > 0) console.log('Invite codes: required');
    if (config.allowDirectChatCreation) console.log('Direct chat creation: enabled (temporary)');
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);
    await new Promise((resolve) => io.close(resolve));
    await closeMongoDB();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

start().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
