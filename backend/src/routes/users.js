import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createUserLimiter } from '../middleware/rateLimiters.js';
import User from '../models/User.js';
import { asyncHandler, badRequest, clampInt, escapeRegex, HttpError } from '../utils/http.js';
import { publicUser, selfUser } from '../utils/serializers.js';
import { validateCity, validateHandle } from '../utils/validators.js';

const SEARCH_FIELDS = '-passwordHash -email';

/** Users who are not currently suspended. A ban with a past expiry no longer counts. */
const notBanned = () => ({
  $or: [{ isBanned: { $ne: true } }, { banExpiresAt: { $lte: new Date() } }],
});

export const createUserRouter = (config) => {
  const router = express.Router();
  router.use(requireAuth, createUserLimiter(config));

  router.get('/me', (req, res) => {
    res.json({ success: true, user: selfUser(req.account) });
  });

  router.put(
    '/me',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {};
      const account = req.account;

      for (const field of ['displayName', 'bio', 'avatar', 'area']) {
        if (body[field] !== undefined) {
          if (typeof body[field] !== 'string') throw badRequest(`${field} must be text`);
          account.set(field, body[field]);
        }
      }
      for (const field of ['interests', 'languages']) {
        if (body[field] !== undefined) {
          if (!Array.isArray(body[field])) throw badRequest(`${field} must be a list`);
          account.set(field, body[field]);
        }
      }
      if (body.city !== undefined) account.set('city', validateCity(body.city, config.cities));

      if (body.preferences !== undefined) {
        if (typeof body.preferences !== 'object' || body.preferences === null) {
          throw badRequest('preferences must be an object');
        }
        for (const key of ['notifications', 'showOnlineStatus', 'showLastSeen']) {
          if (body.preferences[key] !== undefined) {
            if (typeof body.preferences[key] !== 'boolean') throw badRequest(`${key} must be true or false`);
            account.set(`preferences.${key}`, body.preferences[key]);
          }
        }
        if (body.preferences.language !== undefined) {
          if (!['en', 'hi'].includes(body.preferences.language)) throw badRequest('Unsupported language');
          account.set('preferences.language', body.preferences.language);
        }
      }

      await account.save();
      res.json({ success: true, user: selfUser(account) });
    })
  );

  // People in my city, ranked by how many interests we share, then by recent activity.
  router.get(
    '/discover',
    asyncHandler(async (req, res) => {
      const me = req.account;
      const limit = clampInt(req.query.limit, 1, 50, 20);
      const skip = clampInt(req.query.skip, 0, 10_000, 0);

      const match = {
        $and: [
          notBanned(),
          {
            _id: { $nin: [me._id, ...me.blockedUsers] },
            blockedUsers: { $ne: me._id },
            city: me.city,
          },
        ],
      };
      if (typeof req.query.area === 'string' && req.query.area.trim()) {
        match.$and.push({ area: req.query.area.trim() });
      }
      if (typeof req.query.tag === 'string' && req.query.tag.trim()) {
        match.$and.push({ interests: req.query.tag.trim().toLowerCase() });
      }

      const rows = await User.aggregate([
        { $match: match },
        { $addFields: { sharedCount: { $size: { $setIntersection: ['$interests', me.interests] } } } },
        { $sort: { sharedCount: -1, lastSeen: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit + 1 },
      ]);

      const hasMore = rows.length > limit;
      const users = rows.slice(0, limit).map((row) => ({
        ...publicUser(row),
        sharedInterests: (row.interests || []).filter((interest) => me.interests.includes(interest)),
      }));

      res.json({ success: true, users, hasMore });
    })
  );

  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const me = req.account;
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().replace(/^@/, '') : '';
      if (q.length < 2 || q.length > 30) throw badRequest('Search must be 2-30 characters');

      const safe = escapeRegex(q);
      const users = await User.find({
        $and: [
          notBanned(),
          {
            _id: { $nin: [me._id, ...me.blockedUsers] },
            blockedUsers: { $ne: me._id },
            $or: [{ handle: new RegExp(`^${safe}`) }, { displayName: new RegExp(safe, 'i') }, { interests: q }],
          },
        ],
      })
        .select(SEARCH_FIELDS)
        .sort({ lastSeen: -1 })
        .limit(clampInt(req.query.limit, 1, 50, 20));

      res.json({ success: true, users: users.map(publicUser) });
    })
  );

  router.get(
    '/blocked',
    asyncHandler(async (req, res) => {
      const users = await User.find({ _id: { $in: req.account.blockedUsers } }).select(SEARCH_FIELDS);
      res.json({ success: true, users: users.map(publicUser) });
    })
  );

  const findTarget = async (me, rawHandle) => {
    const target = await User.findOne({ handle: validateHandle(rawHandle) });
    if (!target || String(target._id) === String(me._id)) throw new HttpError(404, 'User not found');
    return target;
  };

  router.post(
    '/:handle/block',
    asyncHandler(async (req, res) => {
      const target = await findTarget(req.account, req.params.handle);
      await User.updateOne({ _id: req.account._id }, { $addToSet: { blockedUsers: target._id } });
      res.json({ success: true });
    })
  );

  router.delete(
    '/:handle/block',
    asyncHandler(async (req, res) => {
      const target = await findTarget(req.account, req.params.handle);
      await User.updateOne({ _id: req.account._id }, { $pull: { blockedUsers: target._id } });
      res.json({ success: true });
    })
  );

  // Public profile. Anyone who blocked me, or whom I blocked, simply does not exist.
  router.get(
    '/:handle',
    asyncHandler(async (req, res) => {
      const me = req.account;
      const target = await User.findOne({ handle: validateHandle(req.params.handle) }).select(SEARCH_FIELDS);

      const hidden =
        !target ||
        target.isBannedNow() ||
        target.blockedUsers.some((id) => String(id) === String(me._id)) ||
        me.blockedUsers.some((id) => String(id) === String(target._id));
      if (hidden) throw new HttpError(404, 'User not found');

      res.json({ success: true, user: publicUser(target) });
    })
  );

  return router;
};
