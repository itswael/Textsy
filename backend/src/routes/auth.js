import bcrypt from 'bcryptjs';
import express from 'express';
import { requireAuth, signToken } from '../middleware/auth.js';
import { createAuthLimiter, createUserLimiter } from '../middleware/rateLimiters.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { asyncHandler, badRequest, HttpError } from '../utils/http.js';
import { selfUser } from '../utils/serializers.js';
import {
  requireString,
  validateCity,
  validateEmail,
  validateHandle,
  validatePassword,
} from '../utils/validators.js';

// Compared against when the account does not exist, so response time does not
// reveal whether an email or handle is registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const createAuthRouter = (config) => {
  const router = express.Router();
  const authLimiter = createAuthLimiter(config);
  const userLimiter = createUserLimiter(config);

  router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const body = req.body ?? {};

      if (config.inviteCodes.length > 0) {
        const code = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
        if (!config.inviteCodes.includes(code)) {
          throw new HttpError(403, 'A valid invite code is required', 'invite_required');
        }
      }
      if (body.ageConfirmed !== true) throw badRequest('You must confirm that you are 18 or older');

      const email = validateEmail(body.email);
      const handle = validateHandle(body.handle);
      const password = validatePassword(body.password);
      const city = validateCity(body.city ?? config.cities[0], config.cities);

      const [emailTaken, handleTaken] = await Promise.all([User.exists({ email }), User.exists({ handle })]);
      if (emailTaken) throw new HttpError(409, 'An account with this email already exists', 'email_taken');
      if (handleTaken) throw new HttpError(409, 'That handle is already taken', 'handle_taken');

      const user = await User.create({
        email,
        handle,
        passwordHash: await User.hashPassword(password),
        displayName: typeof body.displayName === 'string' ? body.displayName : '',
        bio: typeof body.bio === 'string' ? body.bio : '',
        interests: Array.isArray(body.interests) ? body.interests : [],
        languages: Array.isArray(body.languages) ? body.languages : [],
        area: typeof body.area === 'string' ? body.area : '',
        city,
        ageConfirmed: true,
        preferences: { language: body.language === 'hi' ? 'hi' : 'en' },
      });

      res.status(201).json({ success: true, token: signToken(user), user: selfUser(user) });
    })
  );

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const identifier = requireString(req.body?.identifier ?? req.body?.email, 'Email or handle')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
      const password = requireString(req.body?.password, 'Password');

      const query = identifier.includes('@') ? { email: identifier } : { handle: identifier };
      const user = await User.findOne(query).select('+passwordHash');

      const passwordOk = user ? await user.verifyPassword(password) : await bcrypt.compare(password, DUMMY_HASH);
      if (!user || !passwordOk) throw new HttpError(401, 'Incorrect email/handle or password');

      if (user.isBannedNow()) throw new HttpError(403, 'This account is suspended', 'banned');

      res.json({ success: true, token: signToken(user), user: selfUser(user) });
    })
  );

  router.get('/me', requireAuth, userLimiter, (req, res) => {
    res.json({ success: true, user: selfUser(req.account) });
  });

  // Permanently deletes the account. Requires the password as confirmation.
  router.delete(
    '/me',
    requireAuth,
    userLimiter,
    asyncHandler(async (req, res) => {
      const password = requireString(req.body?.password, 'Password');
      const account = await User.findById(req.userId).select('+passwordHash');
      if (!(await account.verifyPassword(password))) throw new HttpError(401, 'Incorrect password');

      const userId = account._id;
      await Message.updateMany({ sender: userId }, { $set: { text: '[deleted]', deletedAt: new Date() } });
      await Chat.updateMany({ participants: userId }, { $set: { isActive: false } });
      await User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } });
      await User.deleteOne({ _id: userId });

      // Drop any live connections for this account.
      req.app.get('io')?.in(`user:${userId}`).disconnectSockets(true);

      res.json({ success: true, message: 'Account deleted' });
    })
  );

  return router;
};
