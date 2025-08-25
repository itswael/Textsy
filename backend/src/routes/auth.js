import express from 'express';
import jwt from 'jsonwebtoken';
import admin from '../config/firebase.js';
import { verifyFirebaseToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Verify Firebase token and create/update user
router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      // Create new user
      user = new User({
        firebaseUid: uid,
        email: email || '',
        name: name || 'User',
        bio: '',
        interests: [],
        isOnline: true,
        lastSeen: new Date(),
        preferences: {
          notifications: true,
          location: false,
          showOnlineStatus: true,
          showLastSeen: true
        }
      });
      await user.save();
    } else {
      // Update existing user's online status
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { uid: user._id, firebaseUid: uid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
        isOnline: user.isOnline,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Auth verification error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token revoked. Please login again.' });
    }
    
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Refresh JWT token
router.post('/refresh', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = jwt.sign(
      { uid: user._id, firebaseUid: user.firebaseUid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
        isOnline: user.isOnline,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Google Sign-In (alternative endpoint)
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    // Verify Google token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      user = new User({
        firebaseUid: uid,
        email: email || '',
        name: name || 'User',
        bio: '',
        interests: [],
        avatar: picture || '',
        isOnline: true,
        lastSeen: new Date(),
        preferences: {
          notifications: true,
          location: false,
          showOnlineStatus: true,
          showLastSeen: true
        }
      });
      await user.save();
    } else {
      user.isOnline = true;
      user.lastSeen = new Date();
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { uid: user._id, firebaseUid: uid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
        isOnline: user.isOnline,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Logout
router.post('/logout', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save();
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify JWT token
router.get('/verify-token', verifyFirebaseToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Token is valid',
    user: req.user 
  });
});

// Get user profile by Firebase UID
router.get('/profile/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const user = await User.findOne({ firebaseUid }).select('-blockedUsers -reportedBy');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        bio: user.bio,
        interests: user.interests,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
