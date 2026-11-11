import { authenticateToken, bearerToken } from '../middleware/auth.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { isBlockedEitherWay } from './blocking.js';
import { findChatForUser, markChatRead, sendMessage } from './chatService.js';
import { serializeLastMessage, serializeMessage } from '../utils/serializers.js';

// userId -> ids of that user's open sockets (a user can be signed in on several devices).
const connections = new Map();

const SEND_LIMIT = { max: 20, windowMs: 10_000 };
const recentSends = new Map();

const allowSend = (userId) => {
  const now = Date.now();
  const recent = (recentSends.get(userId) || []).filter((at) => now - at < SEND_LIMIT.windowMs);
  if (recent.length >= SEND_LIMIT.max) {
    recentSends.set(userId, recent);
    return false;
  }
  recent.push(now);
  recentSends.set(userId, recent);
  return true;
};

/** Every socket joins `user:<id>`, so events can be sent to a person on all their devices. */
export const emitToUser = (io, userId, event, payload) => io.to(`user:${userId}`).emit(event, payload);

const errorReply = (error) => ({
  ok: false,
  error: error.statusCode ? error.message : 'Something went wrong',
  code: error.code || 'error',
});

/**
 * Tells only the people who share a chat with this user that their presence
 * changed, and only if the user allows showing it. Never broadcast globally.
 */
const announcePresence = async (io, userId, isOnline, lastSeen) => {
  const user = await User.findById(userId).select('preferences');
  if (!user || user.preferences?.showOnlineStatus === false) return;

  const chats = await Chat.find({ participants: userId, isActive: true }).select('participants');
  const showLastSeen = user.preferences?.showLastSeen !== false;
  const payload = { userId: String(userId), isOnline, lastSeen: showLastSeen ? lastSeen : null };

  for (const chat of chats) {
    for (const participant of chat.participants) {
      if (String(participant) !== String(userId)) emitToUser(io, participant, 'presence', payload);
    }
  }
};

export const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || bearerToken(socket.handshake.headers.authorization);
      const user = await authenticateToken(token);
      socket.data.userId = String(user._id);
      next();
    } catch (error) {
      next(new Error(error.statusCode ? error.message : 'Authentication failed'));
    }
  });

  // Listeners must all be attached synchronously. A client may emit the instant
  // it is connected, and anything that arrives before a listener exists is lost.
  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(`user:${userId}`);

    const sockets = connections.get(userId) || new Set();
    sockets.add(socket.id);
    connections.set(userId, sockets);

    if (sockets.size === 1) {
      const now = new Date();
      User.updateOne({ _id: userId }, { $set: { isOnline: true, lastSeen: now } })
        .then(() => announcePresence(io, userId, true, now))
        .catch((error) => console.error('Failed to record presence:', error));
    }

    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!allowSend(userId)) {
          return reply({ ok: false, error: 'You are sending messages too fast', code: 'rate_limited' });
        }

        const { message, chat, otherId, duplicate } = await sendMessage(userId, payload ?? {});
        const serialized = serializeMessage(message);

        // A retried send is acknowledged but not delivered a second time.
        if (!duplicate) {
          const lastMessage = serializeLastMessage(chat.lastMessage);
          for (const participantId of [userId, otherId]) {
            emitToUser(io, participantId, 'message:new', { message: serialized });
            emitToUser(io, participantId, 'chat:updated', {
              chatId: String(chat._id),
              lastMessage,
              unread: chat.unread.get(participantId) ?? 0,
            });
          }
        }

        return reply({ ok: true, message: serialized, duplicate });
      } catch (error) {
        if (!error.statusCode) console.error('message:send failed:', error);
        return reply(errorReply(error));
      }
    });

    socket.on('typing', async (payload) => {
      try {
        const { chatId, isTyping } = payload ?? {};
        const { otherId } = await findChatForUser(chatId, userId);
        emitToUser(io, otherId, 'typing', { chatId, userId, isTyping: Boolean(isTyping) });
      } catch {
        // Typing indicators are best-effort; ignore invalid or stale chats.
      }
    });

    socket.on('chat:read', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const { chatId, otherId, readAt } = await markChatRead(userId, payload?.chatId);
        emitToUser(io, userId, 'chat:updated', { chatId, unread: 0 });
        if (!(await isBlockedEitherWay(userId, otherId))) {
          emitToUser(io, otherId, 'chat:read', { chatId, userId, readAt });
        }
        return reply({ ok: true });
      } catch (error) {
        return reply(errorReply(error));
      }
    });

    socket.on('disconnect', async () => {
      const open = connections.get(userId);
      open?.delete(socket.id);
      if (open && open.size > 0) return;

      connections.delete(userId);
      recentSends.delete(userId);
      const now = new Date();
      await User.updateOne({ _id: userId }, { $set: { isOnline: false, lastSeen: now } }).catch(() => {});
      announcePresence(io, userId, false, now).catch(() => {});
    });
  });
};

export const isUserOnline = (userId) => connections.has(String(userId));
