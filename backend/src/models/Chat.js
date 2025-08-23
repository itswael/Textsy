import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    groupName: String,
    groupAvatar: String,
    groupDescription: String,
    groupRules: [String]
  },
  settings: {
    allowInvites: {
      type: Boolean,
      default: true
    },
    readReceipts: {
      type: Boolean,
      default: true
    },
    typingIndicators: {
      type: Boolean,
      default: true
    }
  },
  pinnedMessages: [{
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pinnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
chatSchema.index({ participants: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ lastMessage: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ 'archivedBy.user': 1 });

// Ensure only 2 participants for direct chats
chatSchema.pre('save', function(next) {
  if (this.type === 'direct' && this.participants.length !== 2) {
    return next(new Error('Direct chats must have exactly 2 participants'));
  }
  next();
});

// Method to add participant (for group chats)
chatSchema.methods.addParticipant = function(userId) {
  if (this.type === 'group' && !this.participants.includes(userId)) {
    this.participants.push(userId);
    this.unreadCounts.set(userId.toString(), 0);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove participant (for group chats)
chatSchema.methods.removeParticipant = function(userId) {
  if (this.type === 'group') {
    this.participants = this.participants.filter(id => id.toString() !== userId.toString());
    this.unreadCounts.delete(userId.toString());
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to update unread count
chatSchema.methods.updateUnreadCount = function(userId, increment = 1) {
  const currentCount = this.unreadCounts.get(userId.toString()) || 0;
  this.unreadCounts.set(userId.toString(), Math.max(0, currentCount + increment));
  return this.save();
};

// Method to reset unread count
chatSchema.methods.resetUnreadCount = function(userId) {
  this.unreadCounts.set(userId.toString(), 0);
  return this.save();
};

// Method to archive chat for user
chatSchema.methods.archiveForUser = function(userId) {
  const existingArchive = this.archivedBy.find(archive => 
    archive.user.toString() === userId.toString()
  );
  
  if (!existingArchive) {
    this.archivedBy.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unarchive chat for user
chatSchema.methods.unarchiveForUser = function(userId) {
  this.archivedBy = this.archivedBy.filter(archive => 
    archive.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to pin message
chatSchema.methods.pinMessage = function(messageId, userId) {
  const existingPin = this.pinnedMessages.find(pin => 
    pin.message.toString() === messageId.toString()
  );
  
  if (!existingPin) {
    this.pinnedMessages.push({
      message: messageId,
      pinnedBy: userId
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unpin message
chatSchema.methods.unpinMessage = function(messageId) {
  this.pinnedMessages = this.pinnedMessages.filter(pin => 
    pin.message.toString() !== messageId.toString()
  );
  return this.save();
};

// Static method to find chats by participant
chatSchema.statics.findByParticipant = function(userId, options = {}) {
  const query = {
    participants: userId,
    isActive: true
  };
  
  if (options.excludeArchived) {
    query['archivedBy.user'] = { $ne: userId };
  }
  
  return this.find(query)
    .populate('participants', 'name avatar isOnline lastSeen')
    .populate('lastMessage', 'content sender createdAt')
    .populate('metadata.createdBy', 'name avatar')
    .sort({ updatedAt: -1 });
};

// Static method to find direct chat between two users
chatSchema.statics.findDirectChat = function(userId1, userId2) {
  return this.findOne({
    type: 'direct',
    participants: { $all: [userId1, userId2] },
    isActive: true
  });
};

// Static method to create direct chat
chatSchema.statics.createDirectChat = function(userId1, userId2) {
  return this.create({
    type: 'direct',
    participants: [userId1, userId2],
    unreadCounts: new Map([
      [userId1.toString(), 0],
      [userId2.toString(), 0]
    ])
  });
};

// Virtual for total unread count
chatSchema.virtual('totalUnreadCount').get(function() {
  let total = 0;
  for (const count of this.unreadCounts.values()) {
    total += count;
  }
  return total;
});

export default mongoose.model('Chat', chatSchema);
