import express from 'express';
import { checkUserNotBanned, verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);
router.use(checkUserNotBanned);

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.user;
    
    const user = await User.findById(userId).select('-blockedUsers -reportedBy');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { userId } = req.user;
    const { name, bio, interests, avatar, location, preferences } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (interests) updateData.interests = interests;
    if (avatar) updateData.avatar = avatar;
    if (location) updateData.location = location;
    if (preferences) updateData.preferences = preferences;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-blockedUsers -reportedBy');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user discovery (potential matches)
router.get('/discover', async (req, res) => {
  try {
    const { userId } = req.user;
    const { 
      interests, 
      maxDistance = 50, 
      limit = 20, 
      skip = 0,
      excludeBlocked = true 
    } = req.query;
    
    // Get current user's preferences
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build query
    const query = {
      _id: { $ne: userId },
      isBanned: false
    };
    
    // Filter by interests if provided
    if (interests && interests.length > 0) {
      query.interests = { $in: interests };
    }
    
    // Filter by location if user has location sharing enabled
    if (currentUser.preferences?.locationSharing && currentUser.location?.coordinates) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: currentUser.location.coordinates
          },
          $maxDistance: (maxDistance || currentUser.preferences.maxDistance) * 1000 // Convert km to meters
        }
      };
    }
    
    // Exclude blocked users
    if (excludeBlocked === 'true' && currentUser.blockedUsers.length > 0) {
      query._id = { $nin: currentUser.blockedUsers };
    }
    
    const users = await User.find(query)
      .select('name avatar bio interests location isOnline lastSeen')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ isOnline: -1, lastSeen: -1 });
    
    // Apply privacy settings
    const filteredUsers = users.map(user => {
      const filteredUser = { ...user.toObject() };
      
      if (!user.preferences?.privacy?.showOnlineStatus) {
        filteredUser.isOnline = false;
      }
      
      if (!user.preferences?.privacy?.showLastSeen) {
        filteredUser.lastSeen = null;
      }
      
      if (!user.preferences?.privacy?.showLocation) {
        filteredUser.location = null;
      }
      
      return filteredUser;
    });
    
    res.json({
      success: true,
      users: filteredUsers,
      total: filteredUsers.length,
      hasMore: filteredUsers.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('User discovery error:', error);
    res.status(500).json({ error: 'Failed to fetch user discovery' });
  }
});

// Search users
router.get('/search', async (req, res) => {
  try {
    const { userId } = req.user;
    const { q, limit = 20, skip = 0 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const query = {
      _id: { $ne: userId },
      isBanned: false,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } },
        { interests: { $in: [new RegExp(q, 'i')] } }
      ]
    };
    
    // Exclude blocked users
    if (currentUser.blockedUsers.length > 0) {
      query._id = { $nin: currentUser.blockedUsers };
    }
    
    const users = await User.find(query)
      .select('name avatar bio interests location isOnline lastSeen')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ isOnline: -1, lastSeen: -1 });
    
    // Apply privacy settings
    const filteredUsers = users.map(user => {
      const filteredUser = { ...user.toObject() };
      
      if (!user.preferences?.privacy?.showOnlineStatus) {
        filteredUser.isOnline = false;
      }
      
      if (!user.preferences?.privacy?.showLastSeen) {
        filteredUser.lastSeen = null;
      }
      
      if (!user.preferences?.privacy?.showLocation) {
        filteredUser.location = null;
      }
      
      return filteredUser;
    });
    
    res.json({
      success: true,
      users: filteredUsers,
      total: filteredUsers.length,
      hasMore: filteredUsers.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Block user
router.post('/block/:userId', async (req, res) => {
  try {
    const { userId: currentUserId } = req.user;
    const { userId: targetUserId } = req.params;
    
    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    
    await currentUser.blockUser(targetUserId);
    
    res.json({
      success: true,
      message: 'User blocked successfully'
    });
    
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock user
router.delete('/block/:userId', async (req, res) => {
  try {
    const { userId: currentUserId } = req.user;
    const { userId: targetUserId } = req.params;
    
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await currentUser.unblockUser(targetUserId);
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
    
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get blocked users
router.get('/blocked', async (req, res) => {
  try {
    const { userId } = req.user;
    
    const user = await User.findById(userId).populate('blockedUsers', 'name avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      blockedUsers: user.blockedUsers
    });
    
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Report user
router.post('/report/:userId', async (req, res) => {
  try {
    const { userId: reporterId } = req.user;
    const { userId: reportedUserId } = req.params;
    const { reason } = req.body;
    
    if (reporterId === reportedUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }
    
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Report reason must be at least 10 characters' });
    }
    
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ error: 'Reported user not found' });
    }
    
    // Check if already reported
    const existingReport = reportedUser.reportedBy.find(
      report => report.user.toString() === reporterId
    );
    
    if (existingReport) {
      return res.status(400).json({ error: 'User already reported' });
    }
    
    reportedUser.reportedBy.push({
      user: reporterId,
      reason: reason.trim()
    });
    
    await reportedUser.save();
    
    res.json({
      success: true,
      message: 'User reported successfully'
    });
    
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ error: 'Failed to report user' });
  }
});

// Update user preferences
router.put('/preferences', async (req, res) => {
  try {
    const { userId } = req.user;
    const preferences = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { preferences },
      { new: true, runValidators: true }
    ).select('-blockedUsers -reportedBy');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      preferences: user.preferences
    });
    
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get user by ID (public info only)
router.get('/:userId', async (req, res) => {
  try {
    const { userId: currentUserId } = req.user;
    const { userId: targetUserId } = req.params;
    
    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Use /profile endpoint for your own profile' });
    }
    
    const targetUser = await User.findById(targetUserId).select('name avatar bio interests location isOnline lastSeen');
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if current user is blocked by target user
    const currentUser = await User.findById(currentUserId);
    if (currentUser && currentUser.blockedUsers.includes(targetUserId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Apply privacy settings
    if (!targetUser.preferences?.privacy?.showOnlineStatus) {
      targetUser.isOnline = false;
    }
    
    if (!targetUser.preferences?.privacy?.showLastSeen) {
      targetUser.lastSeen = null;
    }
    
    if (!targetUser.preferences?.privacy?.showLocation) {
      targetUser.location = null;
    }
    
    res.json({
      success: true,
      user: targetUser
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
