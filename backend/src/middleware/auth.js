import jwt from 'jsonwebtoken';
import { getConfig } from '../config/index.js';
import User from '../models/User.js';
import { HttpError } from '../utils/http.js';

export const signToken = (user) => {
  const { jwtSecret, jwtExpiresIn } = getConfig();
  return jwt.sign({ sub: String(user._id) }, jwtSecret, { algorithm: 'HS256', expiresIn: jwtExpiresIn });
};

/**
 * Resolves a bearer token to a live, non-banned account. Used by both the
 * HTTP middleware and the socket handshake so they can never disagree.
 */
export const authenticateToken = async (token) => {
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, getConfig().jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid token';
    throw new HttpError(401, message);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Account no longer exists');

  if (user.isBannedNow()) {
    const until = user.banExpiresAt ? ` until ${user.banExpiresAt.toISOString()}` : '';
    throw new HttpError(403, `Account suspended${until}`, 'banned');
  }

  return user;
};

export const bearerToken = (header) => {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

/** Requires a valid session. Sets req.account (full user document). */
export const requireAuth = async (req, res, next) => {
  try {
    req.account = await authenticateToken(bearerToken(req.headers.authorization));
    req.userId = String(req.account._id);
    next();
  } catch (error) {
    next(error);
  }
};
