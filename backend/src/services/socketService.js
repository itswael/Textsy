import jwt from 'jsonwebtoken';
import admin from '../config/firebase.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// Store connected users and their socket information
const connectedUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const userChats = new Map(); // userId -> Set of chatIds

export const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      // Try JWT first
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.uid;
        socket.firebaseUid = decoded.firebaseUid;
      } catch (jwtError) {
        // Fallback to Firebase token
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          const user = await User.findOne({ firebaseUid: decodedToken.uid });
          
          if (!user) {
            return next(new Error('Authentication error: User not found'));
          }
          
          socket.userId = user._id.toString();
          socket.firebaseUid = decodedToken.uid;
        } catch (firebaseError) {
          return next(new Error('Authentication error: Invalid token'));
        }
      }
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);
    
    // Store user connection
    connectedUsers.set(socket.userId, socket.id);
    userSockets.set(socket.id, socket.userId);
    userChats.set(socket.userId, new Set());
    
    // Update user online status
    updateUserOnlineStatus(socket.userId, true);
    
    // Join user to their personal room
    socket.join(`user:${socket.userId}`);
    
    // Handle joining chat rooms
    socket.on('join-chat', async (chatId) => {
      try {
        const chat = await Chat.findById(chatId);
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }
        
        if (!chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }
        
        socket.join(`chat:${chatId}`);
        userChats.get(socket.userId).add(chatId);
        
        console.log(`👥 User ${socket.userId} joined chat ${chatId}`);
        
        // Notify other participants
        socket.to(`chat:${chatId}`).emit('user-joined-chat', {
          userId: socket.userId,
          chatId: chatId
        });
        
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });
    
    // Handle leaving chat rooms
    socket.on('leave-chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
      userChats.get(socket.userId)?.delete(chatId);
      
      console.log(`👋 User ${socket.userId} left chat ${chatId}`);
      
      // Notify other participants
      socket.to(`chat:${chatId}`).emit('user-left-chat', {
        userId: socket.userId,
        chatId: chatId
      });
    });
    
    // Handle typing indicators
    socket.on('typing', async (data) => {
      try {
        const { chatId, isTyping } = data;
        
        // Verify user is in this chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          return;
        }
        
        // Send typing indicator to other chat participants
        socket.to(`chat:${chatId}`).emit('user-typing', {
          userId: socket.userId,
          chatId: chatId,
          isTyping: isTyping
        });
        
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });
    
    // Handle message sending
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', metadata = {} } = data;
        
        // Verify user is in this chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }
        
        // Create message
        const message = new Message({
          chatId: chatId,
          sender: socket.userId,
          content: content,
          messageType: messageType,
          metadata: metadata
        });
        
        await message.save();
        
        // Update chat's last message
        chat.lastMessage = message._id;
        chat.updatedAt = new Date();
        
        // Update unread counts for other participants
        chat.participants.forEach(participantId => {
          if (participantId.toString() !== socket.userId) {
            chat.updateUnreadCount(participantId.toString(), 1);
          }
        });
        
        await chat.save();
        
        // Populate message with sender info
        await message.populate('sender', 'name avatar');
        
        // Broadcast message to chat room
        io.to(`chat:${chatId}`).emit('new-message', {
          message: message,
          chatId: chatId
        });
        
        // Send delivery confirmation to sender
        socket.emit('message-delivered', {
          messageId: message._id,
          chatId: chatId
        });
        
        console.log(`💬 Message sent in chat ${chatId} by user ${socket.userId}`);
        
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle read receipts
    socket.on('mark-read', async (data) => {
      try {
        const { chatId, messageIds } = data;
        
        // Verify user is in this chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          return;
        }
        
        // Mark messages as read
        await Message.updateMany(
          { _id: { $in: messageIds }, chatId: chatId },
          { 
            $addToSet: { 
              readBy: { 
                user: socket.userId, 
                readAt: new Date() 
              } 
            },
            $set: { isRead: true }
          }
        );
        
        // Reset unread count for this user
        chat.resetUnreadCount(socket.userId);
        await chat.save();
        
        // Notify other participants about read receipts
        socket.to(`chat:${chatId}`).emit('messages-read', {
          userId: socket.userId,
          chatId: chatId,
          messageIds: messageIds
        });
        
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });
    
    // Handle message reactions
    socket.on('react-to-message', async (data) => {
      try {
        const { messageId, emoji } = data;
        
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }
        
        // Verify user is in this chat
        const chat = await Chat.findById(message.chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }
        
        // Add or update reaction
        await message.addReaction(socket.userId, emoji);
        
        // Broadcast reaction to chat room
        io.to(`chat:${message.chatId}`).emit('message-reaction', {
          messageId: messageId,
          userId: socket.userId,
          emoji: emoji,
          chatId: message.chatId
        });
        
      } catch (error) {
        console.error('Message reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });
    
    // Handle user status updates
    socket.on('update-status', async (data) => {
      try {
        const { status, customStatus } = data;
        
        // Update user status in database
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: status === 'online',
          lastSeen: new Date()
        });
        
        // Broadcast status update to all connected users
        socket.broadcast.emit('user-status-update', {
          userId: socket.userId,
          status: status,
          customStatus: customStatus
        });
        
      } catch (error) {
        console.error('Status update error:', error);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);
      
      // Clean up user data
      connectedUsers.delete(socket.userId);
      userSockets.delete(socket.id);
      userChats.delete(socket.userId);
      
      // Update user offline status
      updateUserOnlineStatus(socket.userId, false);
      
      // Notify other users about disconnection
      socket.broadcast.emit('user-disconnected', {
        userId: socket.userId
      });
    });
  });
};

// Utility functions for other services
export const sendToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

export const sendToChat = (chatId, event, data) => {
  io.to(`chat:${chatId}`).emit(event, data);
};

export const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

export const getUserChats = (userId) => {
  return userChats.get(userId) || new Set();
};

// Update user online status in database
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, {
      isOnline: isOnline,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error('Failed to update user online status:', error);
  }
};

// Get online users count
export const getOnlineUsersCount = () => {
  return connectedUsers.size;
};

// Get connected users info
export const getConnectedUsersInfo = () => {
  const usersInfo = [];
  
  for (const [userId, socketId] of connectedUsers) {
    usersInfo.push({
      userId: userId,
      socketId: socketId,
      connectedAt: new Date()
    });
  }
  
  return usersInfo;
};
