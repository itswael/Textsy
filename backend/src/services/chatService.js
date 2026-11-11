import Chat from '../models/Chat.js';
import Message, { MAX_MESSAGE_LENGTH } from '../models/Message.js';
import { HttpError, isObjectId } from '../utils/http.js';
import { isBlockedEitherWay } from './blocking.js';

/** Loads a chat only if the user takes part in it and may still use it. */
export const findChatForUser = async (chatId, userId) => {
  if (!isObjectId(chatId)) throw new HttpError(404, 'Chat not found', 'not_found');

  const chat = await Chat.findOne({ _id: chatId, participants: userId, isActive: true });
  if (!chat) throw new HttpError(404, 'Chat not found', 'not_found');

  const otherId = chat.participants.find((id) => String(id) !== String(userId));
  if (await isBlockedEitherWay(userId, otherId)) throw new HttpError(404, 'Chat not found', 'not_found');

  return { chat, otherId: String(otherId) };
};

/**
 * Stores a message and updates the chat's last message and the recipient's
 * unread count in one atomic update. Safe to retry with the same clientId.
 */
export const sendMessage = async (userId, { chatId, text, clientId }) => {
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) throw new HttpError(400, 'Message is empty', 'invalid_text');
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `Message is too long (max ${MAX_MESSAGE_LENGTH})`, 'invalid_text');
  }
  if (clientId !== undefined && (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 64)) {
    throw new HttpError(400, 'Invalid client id', 'invalid_client_id');
  }

  const { chat, otherId } = await findChatForUser(chatId, userId);

  if (clientId) {
    const existing = await Message.findOne({ sender: userId, clientId });
    if (existing) return { message: existing, chat, otherId, duplicate: true };
  }

  let message;
  try {
    message = await Message.create({ chatId: chat._id, sender: userId, text: body, clientId });
  } catch (error) {
    // Two identical sends raced; return the one that won.
    if (error.code === 11000 && clientId) {
      const existing = await Message.findOne({ sender: userId, clientId });
      if (existing) return { message: existing, chat, otherId, duplicate: true };
    }
    throw error;
  }

  const updated = await Chat.findByIdAndUpdate(
    chat._id,
    {
      $set: {
        lastMessage: { messageId: message._id, text: message.text, sender: message.sender, createdAt: message.createdAt },
      },
      $inc: { [`unread.${otherId}`]: 1 },
    },
    { new: true }
  );

  return { message, chat: updated, otherId, duplicate: false };
};

/** Resets the user's unread count for a chat and records when they last read it. */
export const markChatRead = async (userId, chatId) => {
  const { chat, otherId } = await findChatForUser(chatId, userId);
  const readAt = new Date();
  await Chat.updateOne(
    { _id: chat._id },
    { $set: { [`unread.${userId}`]: 0, [`lastReadAt.${userId}`]: readAt } }
  );
  return { chatId: String(chat._id), otherId, readAt };
};
