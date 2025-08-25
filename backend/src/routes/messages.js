import express from 'express';
import { checkChatParticipant, verifyToken } from '../middleware/auth.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);

// Get messages for a chat
router.get('/chat/:chatId', checkChatParticipant, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, skip = 0, before, after } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip)
    };
    
    if (before) options.before = new Date(before);
    if (after) options.after = new Date(after);
    
    const messages = await Message.findByChat(chatId, options);
    
    res.json({
      success: true,
      messages: messages,
      total: messages.length,
      hasMore: messages.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/chat/:chatId', checkChatParticipant, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.user;
    const { content, messageType = 'text', metadata = {}, replyTo } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    // Create message
    const message = new Message({
      chatId: chatId,
      sender: userId,
      content: content.trim(),
      messageType: messageType,
      metadata: metadata,
      replyTo: replyTo
    });
    
    await message.save();
    
    // Update chat's last message and timestamp
    const chat = await Chat.findById(chatId);
    if (chat) {
      chat.lastMessage = message._id;
      chat.updatedAt = new Date();
      
      // Update unread counts for other participants
      chat.participants.forEach(participantId => {
        if (participantId.toString() !== userId) {
          chat.updateUnreadCount(participantId.toString(), 1);
        }
      });
      
      await chat.save();
    }
    
    // Populate message with sender info
    await message.populate('sender', 'name avatar');
    if (replyTo) {
      await message.populate('replyTo', 'content sender');
    }
    
    res.status(201).json({
      success: true,
      message: message
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get message by ID
router.get('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    
    const message = await Message.findById(messageId)
      .populate('sender', 'name avatar')
      .populate('replyTo', 'content sender')
      .populate('readBy.user', 'name avatar')
      .populate('reactions.user', 'name avatar');
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user has access to this message
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ error: 'Access denied to this message' });
    }
    
    res.json({
      success: true,
      message: message
    });
    
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Edit message
router.put('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Can only edit your own messages' });
    }
    
    // Check if message is too old (e.g., 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (message.createdAt < oneHourAgo) {
      return res.status(400).json({ error: 'Cannot edit messages older than 1 hour' });
    }
    
    // Edit message
    await message.edit(content.trim(), userId);
    
    // Populate updated message
    await message.populate('sender', 'name avatar');
    
    res.json({
      success: true,
      message: message
    });
    
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message (soft delete)
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user is the sender or chat admin
    const chat = await Chat.findById(message.chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const isSender = message.sender.toString() === userId;
    const isChatAdmin = chat.metadata.createdBy.toString() === userId;
    
    if (!isSender && !isChatAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    // Soft delete message
    await message.softDelete(userId);
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Mark messages as read
router.post('/chat/:chatId/read', checkChatParticipant, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.user;
    const { messageIds } = req.body;
    
    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({ error: 'Message IDs are required' });
    }
    
    // Mark messages as read
    await Message.updateMany(
      { 
        _id: { $in: messageIds }, 
        chatId: chatId,
        sender: { $ne: userId }
      },
      { 
        $addToSet: { 
          readBy: { 
            user: userId, 
            readAt: new Date() 
          } 
        },
        $set: { isRead: true }
      }
    );
    
    // Update chat unread count
    const chat = await Chat.findById(chatId);
    if (chat) {
      await chat.resetUnreadCount(userId);
    }
    
    res.json({
      success: true,
      message: 'Messages marked as read'
    });
    
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Add reaction to message
router.post('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user has access to this message
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ error: 'Access denied to this message' });
    }
    
    // Add reaction
    await message.addReaction(userId, emoji);
    
    res.json({
      success: true,
      message: 'Reaction added successfully'
    });
    
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from message
router.delete('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user has access to this message
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ error: 'Access denied to this message' });
    }
    
    // Remove reaction
    await message.removeReaction(userId);
    
    res.json({
      success: true,
      message: 'Reaction removed successfully'
    });
    
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Search messages in a chat
router.get('/chat/:chatId/search', checkChatParticipant, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q, limit = 20, skip = 0 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const messages = await Message.search(chatId, q.trim(), {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      messages: messages,
      total: messages.length,
      hasMore: messages.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// Get unread message count for a chat
router.get('/chat/:chatId/unread-count', checkChatParticipant, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.user;
    
    const unreadMessages = await Message.findUnreadForUser(chatId, userId);
    
    res.json({
      success: true,
      unreadCount: unreadMessages.length
    });
    
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Pin message
router.post('/:messageId/pin', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user has access to this message
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ error: 'Access denied to this message' });
    }
    
    // Check if user is chat admin
    if (chat.metadata.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Only chat admin can pin messages' });
    }
    
    // Pin message
    await message.pin(userId);
    
    // Add to chat's pinned messages
    await chat.pinMessage(messageId, userId);
    
    res.json({
      success: true,
      message: 'Message pinned successfully'
    });
    
  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Unpin message
router.delete('/:messageId/pin', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user has access to this message
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ error: 'Access denied to this message' });
    }
    
    // Check if user is chat admin
    if (chat.metadata.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Only chat admin can unpin messages' });
    }
    
    // Unpin message
    await message.unpin();
    
    // Remove from chat's pinned messages
    await chat.unpinMessage(messageId);
    
    res.json({
      success: true,
      message: 'Message unpinned successfully'
    });
    
  } catch (error) {
    console.error('Unpin message error:', error);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

export default router;


