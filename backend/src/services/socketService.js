import jwt from 'jsonwebtoken';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// Store online users
const onlineUsers = new Map();
const userSockets = new Map();

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.uid);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.firebaseUid = user.firebaseUid;
    
    // Update user's online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();
    
    // Store socket mapping
    onlineUsers.set(user._id.toString(), {
      socketId: socket.id,
      userId: user._id.toString(),
      firebaseUid: user.firebaseUid,
      isOnline: true,
      lastSeen: new Date()
    });
    
    userSockets.set(user._id.toString(), socket.id);
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Setup socket handlers
export const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.userId} connected`);
    
    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Handle joining a chat
    socket.on('join-chat', async (chatId) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied to chat' });
          return;
        }

        socket.join(`chat:${chatId}`);
        socket.emit('joined-chat', { chatId });
        
        // Notify other participants
        socket.to(`chat:${chatId}`).emit('user-joined-chat', {
          chatId,
          userId: socket.userId
        });
        
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle leaving a chat
    socket.on('leave-chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
      socket.emit('left-chat', { chatId });
      
      // Notify other participants
      socket.to(`chat:${chatId}`).emit('user-left-chat', {
        chatId,
        userId: socket.userId
      });
    });

    // Handle typing indicator
    socket.on('typing', async (data) => {
      try {
        const { chatId, isTyping } = data;
        const chat = await Chat.findById(chatId);
        
        if (!chat || !chat.participants.includes(socket.userId)) {
          return;
        }

        // Send typing indicator to other chat participants
        socket.to(`chat:${chatId}`).emit('user-typing', {
          chatId,
          userId: socket.userId,
          isTyping
        });
        
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });

    // Handle sending message
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', replyTo, metadata = {} } = data;
        
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied to chat' });
          return;
        }

        // Create new message
        const message = new Message({
          chatId,
          sender: socket.userId,
          content,
          messageType,
          replyTo,
          metadata,
          readBy: [socket.userId] // Sender has read the message
        });

        await message.save();

        // Update chat's last message
        chat.lastMessage = {
          messageId: message._id,
          content: message.content,
          sender: message.sender,
          timestamp: message.createdAt
        };

        // Update unread counts for other participants
        chat.participants.forEach(participantId => {
          if (participantId.toString() !== socket.userId) {
            chat.unreadCounts.set(participantId.toString(), 
              (chat.unreadCounts.get(participantId.toString()) || 0) + 1
            );
          }
        });

        await chat.save();

        // Emit message to all chat participants
        io.to(`chat:${chatId}`).emit('new-message', {
          message: {
            id: message._id,
            chatId: message.chatId,
            sender: message.sender,
            content: message.content,
            messageType: message.messageType,
            replyTo: message.replyTo,
            metadata: message.metadata,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt
          },
          chatId
        });

        // Emit chat update to participants
        io.to(`chat:${chatId}`).emit('chat-updated', {
          chatId,
          lastMessage: chat.lastMessage,
          unreadCounts: Object.fromEntries(chat.unreadCounts)
        });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle marking message as read
    socket.on('mark-read', async (data) => {
      try {
        const { chatId, messageIds } = data;
        
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          return;
        }

        // Mark messages as read
        await Message.updateMany(
          { _id: { $in: messageIds }, chatId },
          { $addToSet: { readBy: socket.userId } }
        );

        // Reset unread count for this user
        chat.unreadCounts.set(socket.userId, 0);
        await chat.save();

        // Notify other participants
        socket.to(`chat:${chatId}`).emit('messages-read', {
          chatId,
          userId: socket.userId,
          messageIds
        });

        // Emit updated unread counts
        io.to(`chat:${chatId}`).emit('chat-updated', {
          chatId,
          unreadCounts: Object.fromEntries(chat.unreadCounts)
        });

      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle message reactions
    socket.on('react-to-message', async (data) => {
      try {
        const { messageId, reaction } = data;
        
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user is in the chat
        const chat = await Chat.findById(message.chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied to message' });
          return;
        }

        // Add or update reaction
        const existingReaction = message.reactions.find(r => r.userId.toString() === socket.userId);
        if (existingReaction) {
          existingReaction.emoji = reaction;
          existingReaction.updatedAt = new Date();
        } else {
          message.reactions.push({
            userId: socket.userId,
            emoji: reaction,
            createdAt: new Date()
          });
        }

        await message.save();

        // Emit reaction to all chat participants
        io.to(`chat:${message.chatId}`).emit('message-reaction', {
          messageId,
          userId: socket.userId,
          reaction,
          reactions: message.reactions
        });

      } catch (error) {
        console.error('Message reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // Handle status updates
    socket.on('update-status', async (data) => {
      try {
        const { status, customStatus } = data;
        
        const user = await User.findById(socket.userId);
        if (!user) {
          return;
        }

        // Update user status
        user.isOnline = status === 'online';
        user.lastSeen = new Date();
        if (customStatus) {
          user.customStatus = customStatus;
        }

        await user.save();

        // Update online users map
        if (onlineUsers.has(socket.userId)) {
          const userData = onlineUsers.get(socket.userId);
          userData.isOnline = user.isOnline;
          userData.lastSeen = user.lastSeen;
          onlineUsers.set(socket.userId, userData);
        }

        // Notify all connected users about status change
        io.emit('user-status-changed', {
          userId: socket.userId,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          customStatus: user.customStatus
        });

      } catch (error) {
        console.error('Status update error:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        console.log(`🔌 User ${socket.userId} disconnected`);
        
        // Update user's online status
        const user = await User.findById(socket.userId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          await user.save();
        }

        // Remove from online users
        onlineUsers.delete(socket.userId);
        userSockets.delete(socket.userId);

        // Notify all users about status change
        io.emit('user-status-changed', {
          userId: socket.userId,
          isOnline: false,
          lastSeen: new Date()
        });

      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });
};

// Utility functions
export const sendToUser = (io, userId, event, data) => {
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

export const sendToChat = (io, chatId, event, data) => {
  io.to(`chat:${chatId}`).emit(event, data);
};

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId) && onlineUsers.get(userId).isOnline;
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers.values());
};
