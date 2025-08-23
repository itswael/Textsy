import express from 'express';
import jwt from 'jsonwebtoken';
import admin from '../config/firebase.js';
import { rateLimit, verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Rate limiting for auth routes
const authRateLimit = rateLimit(5 * 60 * 1000, 10); // 10 attempts per 5 minutes

// Verify Firebase token and create/update user
router.post('/verify', authRateLimit, async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ 
        error: 'ID token is required' 
      });
    }
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;
    
    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      // Create new user
      user = new User({
        firebaseUid: uid,
        email: email,
        name: name || email.split('@')[0],
        interests: ['general'],
        avatar: picture || '👤'
      });
      
      await user.save();
      console.log(`✅ New user created: ${user.name} (${user.email})`);
    } else {
      // Update existing user's Firebase info
      user.email = email;
      if (name) user.name = name;
      if (picture) user.avatar = picture;
      user.lastSeen = new Date();
      
      await user.save();
      console.log(`✅ User updated: ${user.name} (${user.email})`);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: user._id, 
        firebaseUid: uid,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Return user data and token
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        bio: user.bio,
        interests: user.interests,
        avatar: user.avatar,
        location: user.location,
        preferences: user.preferences,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Auth verification error:', error);
    
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
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ 
        error: 'Invalid token. Please login again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Authentication failed. Please try again.' 
    });
  }
});

// Refresh JWT token
router.post('/refresh', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    // Generate new token
    const token = jwt.sign(
      { 
        uid: user._id, 
        firebaseUid: user.firebaseUid,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        bio: user.bio,
        interests: user.interests,
        avatar: user.avatar,
        location: user.location,
        preferences: user.preferences,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed. Please try again.' 
    });
  }
});

// Google Sign-In (alternative endpoint)
router.post('/google', authRateLimit, async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ 
        error: 'Google ID token is required' 
      });
    }
    
    // Verify Google token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture, providerData } = decodedToken;
    
    // Check if it's a Google account
    const isGoogleAccount = providerData.some(provider => 
      provider.providerId === 'google.com'
    );
    
    if (!isGoogleAccount) {
      return res.status(400).json({ 
        error: 'Invalid Google account' 
      });
    }
    
    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      // Create new user
      user = new User({
        firebaseUid: uid,
        email: email,
        name: name || email.split('@')[0],
        interests: ['general'],
        avatar: picture || '👤',
        isVerified: true // Google accounts are pre-verified
      });
      
      await user.save();
      console.log(`✅ New Google user created: ${user.name} (${user.email})`);
    } else {
      // Update existing user
      user.email = email;
      if (name) user.name = name;
      if (picture) user.avatar = picture;
      user.lastSeen = new Date();
      user.isVerified = true;
      
      await user.save();
      console.log(`✅ Google user updated: ${user.name} (${user.email})`);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: user._id, 
        firebaseUid: uid,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        bio: user.bio,
        interests: user.interests,
        avatar: user.avatar,
        location: user.location,
        preferences: user.preferences,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      error: 'Google authentication failed. Please try again.' 
    });
  }
});

// Logout (optional - mainly for server-side cleanup)
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Update user's last seen and online status
    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date()
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed. Please try again.' 
    });
  }
});

// Verify JWT token validity
router.get('/verify-token', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    const user = await User.findById(userId).select('-blockedUsers -reportedBy');
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        bio: user.bio,
        interests: user.interests,
        avatar: user.avatar,
        location: user.location,
        preferences: user.preferences,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      error: 'Token verification failed' 
    });
  }
});

// Get user profile by Firebase UID (for public access)
router.get('/profile/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    
    const user = await User.findOne({ firebaseUid }).select('name avatar bio interests location isOnline lastSeen');
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    // Check if user wants to show their online status
    if (!user.preferences?.privacy?.showOnlineStatus) {
      user.isOnline = false;
    }
    
    // Check if user wants to show their last seen
    if (!user.preferences?.privacy?.showLastSeen) {
      user.lastSeen = null;
    }
    
    // Check if user wants to show their location
    if (!user.preferences?.privacy?.showLocation) {
      user.location = null;
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests,
        location: user.location,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      }
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user profile' 
    });
  }
});

export default router;
