import jwt from 'jsonwebtoken';
import admin from '../config/firebase.js';
import User from '../models/User.js';

// Verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.uid, firebaseUid: decoded.firebaseUid };
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token. Please login again.' 
      });
    }
    
    console.error('Token verification error:', error);
    return res.status(401).json({ 
      error: 'Invalid token.' 
    });
  }
};

// Verify Firebase token (alternative to JWT)
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = { firebaseUid: decodedToken.uid };
    
    // Find user in database
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found. Please complete registration.' 
      });
    }
    
    req.user.userId = user._id;
    next();
    
  } catch (error) {
    console.error('Firebase token verification error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.' 
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: 'Token revoked. Please login again.' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token. Please login again.' 
    });
  }
};

// Optional authentication (user can be authenticated or not)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: decoded.uid, firebaseUid: decoded.firebaseUid };
      } catch (error) {
        // Token is invalid, but we continue without authentication
        console.log('Optional auth: Invalid token, continuing as guest');
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Check if user is the owner of a resource
export const checkOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const resourceUserId = req.body[resourceField] || req.params[resourceField] || req.query[resourceField];
    
    if (req.user.userId.toString() !== resourceUserId?.toString()) {
      return res.status(403).json({ 
        error: 'Access denied. You can only modify your own resources.' 
      });
    }
    
    next();
  };
};

// Check if user is participant in a chat
export const checkChatParticipant = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { chatId } = req.params;
    const Chat = (await import('../models/Chat.js')).default;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (!chat.participants.includes(req.user.userId)) {
      return res.status(403).json({ 
        error: 'Access denied. You are not a participant in this chat.' 
      });
    }
    
    req.chat = chat;
    next();
    
  } catch (error) {
    console.error('Chat participant check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Rate limiting middleware
export const rateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      const requestData = requests.get(ip);
      
      if (now > requestData.resetTime) {
        requestData.count = 1;
        requestData.resetTime = now + windowMs;
      } else {
        requestData.count++;
      }
      
      if (requestData.count > max) {
        return res.status(429).json({ 
          error: 'Too many requests. Please try again later.' 
        });
      }
    }
    
    next();
  };
};

// Admin role check
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ 
        error: 'Access denied. Admin role required.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is banned
export const checkUserNotBanned = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.isBanned) {
      if (user.banExpiresAt && user.banExpiresAt > new Date()) {
        return res.status(403).json({ 
          error: `Account suspended until ${user.banExpiresAt.toISOString()}. Reason: ${user.banReason}` 
        });
      } else if (!user.banExpiresAt) {
        return res.status(403).json({ 
          error: `Account permanently banned. Reason: ${user.banReason}` 
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Ban check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
