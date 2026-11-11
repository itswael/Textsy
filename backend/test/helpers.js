import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { io as connect } from 'socket.io-client';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';

const { getConfig } = await import('../src/config/index.js');
const { createApp } = await import('../src/app.js');
const { createServer } = await import('../src/server.js');
const { default: User } = await import('../src/models/User.js');
const { default: Chat } = await import('../src/models/Chat.js');
const { default: Message } = await import('../src/models/Message.js');

export { Chat, Message, User };

/** Starts MongoDB (in memory) and the full app on a random port. */
export const startTestServer = async (overrides = {}) => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Chat.init(), Message.init()]);

  const config = { ...getConfig(), ...overrides };
  const { app, server, io } = createServer(config);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const sockets = [];
  return {
    app,
    config,
    url: `http://127.0.0.1:${port}`,
    api: request(app),
    /** A second API on the same database with different config (e.g. invite codes). */
    apiWith: (patch) => request(createApp({ ...config, ...patch })),
    /** Opens an authenticated socket and waits until it is connected. */
    socket: async (token) => {
      const socket = connect(`http://127.0.0.1:${port}`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      sockets.push(socket);
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      return socket;
    },
    reset: async () => {
      await Promise.all([User.deleteMany({}), Chat.deleteMany({}), Message.deleteMany({})]);
    },
    stop: async () => {
      sockets.forEach((socket) => socket.close());
      await new Promise((resolve) => io.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
};

let counter = 0;

/** Registers a user through the real API and returns their token and profile. */
export const register = async (api, overrides = {}) => {
  counter += 1;
  const body = {
    email: `user${counter}@example.com`,
    handle: `user${counter}`,
    password: 'password123',
    ageConfirmed: true,
    city: 'Meerut',
    ...overrides,
  };
  const res = await api.post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, password: body.password };
};

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** Resolves with the first payload of `event`, or rejects after a timeout. */
export const waitFor = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

/** Resolves true if `event` does NOT arrive within `ms`. */
export const stays = (socket, event, ms = 300) =>
  new Promise((resolve) => {
    const handler = () => resolve(false);
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
  });

export const emitWithAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
