import dotenv from 'dotenv';

dotenv.config();

const toBool = (value, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const toList = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Reads configuration from the environment. Called lazily (not at import time)
 * so tests can set environment variables before building the app.
 */
export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const secret = process.env.JWT_SECRET;

  if (env === 'production' && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
  }

  const cities = toList(process.env.CITIES);

  return {
    env,
    port: toInt(process.env.PORT, 3000),
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/textsy',
    jwtSecret: secret || 'dev-only-insecure-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
    // Native apps are not subject to CORS; this only matters for the web build.
    corsOrigins: toList(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:19006'),
    // Number of reverse proxies in front of the app (1 when behind Caddy/nginx).
    trustProxy: toInt(process.env.TRUST_PROXY, 0),
    // Closed beta: when non-empty, signup requires one of these codes.
    inviteCodes: toList(process.env.INVITE_CODES),
    cities: cities.length > 0 ? cities : ['Meerut'],
    // Temporary until intro requests land: lets users open a chat by handle.
    allowDirectChatCreation: toBool(process.env.ALLOW_DIRECT_CHAT_CREATION, env !== 'production'),
    rateLimit: {
      windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      // Per signed-in user. Not per IP: many mobile users share one carrier IP.
      userMax: toInt(process.env.RATE_LIMIT_USER_MAX, 600),
      // Signup/login attempts per IP + identifier.
      authMax: toInt(process.env.RATE_LIMIT_AUTH_MAX, 20),
    },
  };
};
