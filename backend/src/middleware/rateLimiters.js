import rateLimit from 'express-rate-limit';

const tooMany = { error: 'Too many requests. Please slow down and try again shortly.' };

/**
 * Signup/login throttling, keyed by IP plus the identifier being tried, so one
 * person hammering an account is blocked without locking out everyone behind
 * the same carrier IP.
 */
export const createAuthLimiter = ({ rateLimit: { windowMs, authMax } }) =>
  rateLimit({
    windowMs,
    limit: authMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: tooMany,
    keyGenerator: (req) => `${req.ip}|${String(req.body?.identifier ?? req.body?.email ?? '').toLowerCase()}`,
  });

/** General API throttling per signed-in user. Must run after requireAuth. */
export const createUserLimiter = ({ rateLimit: { windowMs, userMax } }) =>
  rateLimit({
    windowMs,
    limit: userMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: tooMany,
    keyGenerator: (req) => req.userId || req.ip,
  });
