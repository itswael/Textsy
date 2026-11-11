import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createUserLimiter } from '../middleware/rateLimiters.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { isBlockedEitherWay } from '../services/blocking.js';
import { findChatForUser, markChatRead } from '../services/chatService.js';
import { asyncHandler, clampInt, HttpError, isObjectId } from '../utils/http.js';
import {
  PUBLIC_USER_FIELDS,
  publicUser,
  serializeLastMessage,
  serializeMessage,
} from '../utils/serializers.js';
import { validateHandle } from '../utils/validators.js';

const chatView = (chat, meId) => {
  const other = chat.participants.find((participant) => String(participant._id) !== meId);
  return {
    id: String(chat._id),
    other: publicUser(other),
    lastMessage: serializeLastMessage(chat.lastMessage),
    unread: chat.unread?.get(meId) ?? 0,
    updatedAt: chat.updatedAt,
  };
};

export const createChatRouter = (config) => {
  const router = express.Router();
  router.use(requireAuth, createUserLimiter(config));

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const me = req.account;
      const chats = await Chat.find({ participants: me._id, isActive: true })
        .populate('participants', PUBLIC_USER_FIELDS)
        .sort({ updatedAt: -1 })
        .limit(clampInt(req.query.limit, 1, 100, 50));

      const visible = chats.filter((chat) => {
        const other = chat.participants.find((participant) => String(participant._id) !== req.userId);
        if (!other) return false;
        const iBlocked = me.blockedUsers.some((id) => String(id) === String(other._id));
        const theyBlocked = other.blockedUsers.some((id) => String(id) === req.userId);
        return !iBlocked && !theyBlocked;
      });

      res.json({ success: true, chats: visible.map((chat) => chatView(chat, req.userId)) });
    })
  );

  // Opens (or returns) the direct chat with a user. Temporary: once intro
  // requests exist, chats are created only by accepting one.
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      if (!config.allowDirectChatCreation) {
        throw new HttpError(403, 'Chats can only be started through an intro request', 'intro_required');
      }

      const target = await User.findOne({ handle: validateHandle(req.body?.handle) });
      if (!target || String(target._id) === req.userId || target.isBannedNow()) {
        throw new HttpError(404, 'User not found');
      }
      if (await isBlockedEitherWay(req.userId, target._id)) throw new HttpError(404, 'User not found');

      const chat = await Chat.getOrCreateDirect(req.userId, target._id);
      await chat.populate('participants', PUBLIC_USER_FIELDS);
      res.status(201).json({ success: true, chat: chatView(chat, req.userId) });
    })
  );

  router.get(
    '/:chatId',
    asyncHandler(async (req, res) => {
      const { chat } = await findChatForUser(req.params.chatId, req.userId);
      await chat.populate('participants', PUBLIC_USER_FIELDS);
      res.json({ success: true, chat: chatView(chat, req.userId) });
    })
  );

  // Oldest-to-newest page of messages. Pass `before` (a message id) to load older ones.
  router.get(
    '/:chatId/messages',
    asyncHandler(async (req, res) => {
      const { chat } = await findChatForUser(req.params.chatId, req.userId);
      const limit = clampInt(req.query.limit, 1, 100, 30);

      const filter = { chatId: chat._id };
      if (isObjectId(req.query.before)) filter._id = { $lt: req.query.before };

      const rows = await Message.find(filter).sort({ _id: -1 }).limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit).reverse();

      res.json({
        success: true,
        messages: page.map(serializeMessage),
        hasMore,
        nextBefore: hasMore ? String(page[0]._id) : null,
      });
    })
  );

  router.post(
    '/:chatId/read',
    asyncHandler(async (req, res) => {
      await markChatRead(req.userId, req.params.chatId);
      res.json({ success: true });
    })
  );

  return router;
};
