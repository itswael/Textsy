import express from 'express';
import { checkChatParticipant, verifyToken } from '../middleware/auth.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);

// Get user's chats
router.get('/', async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50, skip = 0 } = req.query;
    
    const chats = await Chat.findByParticipant(userId, { excludeArchived: true })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    res.json({
      success: true,
      chats: chats,
      total: chats.length,
      hasMore: chats.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create new chat
router.post('/', async (req, res) => {
  try {
    const { userId } = req.user;
    const { participantIds, type = 'direct' } = req.body;
    
    if (!participantIds || participantIds.length === 0) {
      return res.status(400).json({ error: 'Participant IDs are required' });
    }
    
    // Add current user to participants if not already included
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }
    
    // For direct chats, ensure only 2 participants
    if (type === 'direct' && participantIds.length !== 2) {
      return res.status(400).json({ error: 'Direct chats must have exactly 2 participants' });
    }
    
    // Check if direct chat already exists
    if (type === 'direct') {
      const existingChat = await Chat.findDirectChat(participantIds[0], participantIds[1]);
      if (existingChat) {
        return res.json({
          success: true,
          chat: existingChat,
          message: 'Direct chat already exists'
        });
      }
    }
    
    // Create new chat
    const chat = new Chat({
      type: type,
      participants: participantIds,
      metadata: {
        createdBy: userId
      }
    });
    
    await chat.save();
    
    // Populate chat data
    await chat.populate('participants', 'name avatar isOnline lastSeen');
    
    res.status(201).json({
      success: true,
      chat: chat
    });
    
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get chat by ID
router.get('/:chatId', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    
    await chat.populate('participants', 'name avatar isOnline lastSeen');
    await chat.populate('lastMessage', 'content sender createdAt');
    await chat.populate('metadata.createdBy', 'name avatar');
    
    res.json({
      success: true,
      chat: chat
    });
    
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Update chat settings
router.put('/:chatId', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { settings, metadata } = req.body;
    
    const updateData = {};
    if (settings) updateData.settings = settings;
    if (metadata) updateData.metadata = metadata;
    
    const updatedChat = await Chat.findByIdAndUpdate(
      chat._id,
      updateData,
      { new: true, runValidators: true }
    ).populate('participants', 'name avatar isOnline lastSeen');
    
    res.json({
      success: true,
      chat: updatedChat
    });
    
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Archive chat for user
router.post('/:chatId/archive', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { userId } = req.user;
    
    await chat.archiveForUser(userId);
    
    res.json({
      success: true,
      message: 'Chat archived successfully'
    });
    
  } catch (error) {
    console.error('Archive chat error:', error);
    res.status(500).json({ error: 'Failed to archive chat' });
  }
});

// Unarchive chat for user
router.delete('/:chatId/archive', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { userId } = req.user;
    
    await chat.unarchiveForUser(userId);
    
    res.json({
      success: true,
      message: 'Chat unarchived successfully'
    });
    
  } catch (error) {
    console.error('Unarchive chat error:', error);
    res.status(500).json({ error: 'Failed to unarchive chat' });
  }
});

// Leave chat (for group chats)
router.post('/:chatId/leave', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { userId } = req.user;
    
    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot leave direct chats' });
    }
    
    await chat.removeParticipant(userId);
    
    res.json({
      success: true,
      message: 'Left chat successfully'
    });
    
  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({ error: 'Failed to leave chat' });
  }
});

// Add participant to group chat
router.post('/:chatId/participants', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { participantId } = req.body;
    
    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot add participants to direct chats' });
    }
    
    // Check if user exists
    const user = await User.findById(participantId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is already a participant
    if (chat.participants.includes(participantId)) {
      return res.status(400).json({ error: 'User is already a participant' });
    }
    
    await chat.addParticipant(participantId);
    
    res.json({
      success: true,
      message: 'Participant added successfully'
    });
    
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Remove participant from group chat
router.delete('/:chatId/participants/:participantId', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { participantId } = req.params;
    const { userId } = req.user;
    
    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot remove participants from direct chats' });
    }
    
    // Only chat creator or the participant themselves can remove
    if (chat.metadata.createdBy.toString() !== userId && participantId !== userId) {
      return res.status(403).json({ error: 'Not authorized to remove this participant' });
    }
    
    await chat.removeParticipant(participantId);
    
    res.json({
      success: true,
      message: 'Participant removed successfully'
    });
    
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Get chat participants
router.get('/:chatId/participants', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    
    await chat.populate('participants', 'name avatar isOnline lastSeen');
    
    res.json({
      success: true,
      participants: chat.participants
    });
    
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Delete chat (soft delete)
router.delete('/:chatId', checkChatParticipant, async (req, res) => {
  try {
    const { chat } = req;
    const { userId } = req.user;
    
    // Only chat creator can delete
    if (chat.metadata.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this chat' });
    }
    
    chat.isActive = false;
    await chat.save();
    
    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;
