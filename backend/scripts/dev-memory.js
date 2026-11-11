// Starts the backend against a throw-away in-memory MongoDB.
//
//   npm run dev:memory
//
// Handy for trying the Android app without installing MongoDB: everything is lost when
// you stop it. Uses the same settings as `npm run dev` (PORT, INVITE_CODES, CITIES, ...).
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV ??= 'development';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('textsy');
console.log(`In-memory MongoDB started (data is discarded on exit)`);

process.on('exit', () => {
  mongod.stop().catch(() => {});
});

// Loaded after the environment is set, because the config is read at import time.
await import('../src/index.js');
