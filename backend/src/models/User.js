import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  interests: [{
    type: String,
    trim: true,
    maxlength: 20
  }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    city: String,
    country: String
  },
  avatar: {
    type: String,
    default: '👤'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    locationSharing: {
      type: Boolean,
      default: false
    },
    maxDistance: {
      type: Number,
      default: 50, // km
      min: 1,
      max: 1000
    },
    ageRange: {
      min: {
        type: Number,
        default: 18,
        min: 18
      },
      max: {
        type: Number,
        default: 100,
        max: 100
      }
    },
    privacy: {
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      showLastSeen: {
        type: Boolean,
        default: true
      },
      showLocation: {
        type: Boolean,
        default: false
      }
    }
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reportedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: String,
  banExpiresAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
userSchema.index({ location: '2dsphere' });
userSchema.index({ interests: 1 });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isOnline: 1, lastSeen: -1 });
userSchema.index({ isBanned: 1 });

// Virtual for age calculation (if you store birthDate)
userSchema.virtual('age').get(function() {
  // Implementation depends on whether you store birthDate
  return null;
});

// Method to update online status
userSchema.methods.updateOnlineStatus = function(isOnline) {
  this.isOnline = isOnline;
  this.lastSeen = new Date();
  return this.save();
};

// Method to add interest
userSchema.methods.addInterest = function(interest) {
  if (!this.interests.includes(interest) && this.interests.length < 10) {
    this.interests.push(interest);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove interest
userSchema.methods.removeInterest = function(interest) {
  this.interests = this.interests.filter(i => i !== interest);
  return this.save();
};

// Method to block user
userSchema.methods.blockUser = function(userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unblock user
userSchema.methods.unblockUser = function(userId) {
  this.blockedUsers = this.blockedUsers.filter(id => id.toString() !== userId.toString());
  return this.save();
};

// Static method to find users by interests
userSchema.statics.findByInterests = function(interests, limit = 20) {
  return this.find({
    interests: { $in: interests },
    isBanned: false
  })
  .select('name avatar interests location bio isOnline lastSeen')
  .limit(limit);
};

// Static method to find nearby users
userSchema.statics.findNearby = function(coordinates, maxDistance = 50) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    },
    isBanned: false
  })
  .select('name avatar interests location bio isOnline lastSeen')
  .limit(20);
};

export default mongoose.model('User', userSchema);
