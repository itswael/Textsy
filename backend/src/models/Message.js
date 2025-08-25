import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'location', 'audio', 'video', 'sticker'],
    default: 'text'
  },
  metadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    imageUrl: String,
    videoUrl: String,
    audioUrl: String,
    duration: Number, // for audio/video
    coordinates: [Number], // for location
    address: String, // for location
    thumbnail: String, // for media
    dimensions: {
      width: Number,
      height: Number
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  forwardedFrom: {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    originalChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat'
    }
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    reactedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: Date,
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ 'reactions.user': 1 });
messageSchema.index({ replyTo: 1 });

// Method to mark as read by user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => 
    read.user.toString() === userId.toString()
  );
  
  if (!existingRead) {
    this.readBy.push({ user: userId });
    this.isRead = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  const existingReaction = this.reactions.find(reaction => 
    reaction.user.toString() === userId.toString()
  );
  
  if (existingReaction) {
    existingReaction.emoji = emoji;
    existingReaction.reactedAt = new Date();
  } else {
    this.reactions.push({ user: userId, emoji });
  }
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(reaction => 
    reaction.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to edit message
messageSchema.methods.edit = function(newContent, userId) {
  // Store edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  this.content = newContent;
  this.isEdited = true;
  
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.content = '[Message deleted]';
  
  return this.save();
};

// Method to pin message
messageSchema.methods.pin = function(userId) {
  this.isPinned = true;
  this.pinnedAt = new Date();
  this.pinnedBy = userId;
  
  return this.save();
};

// Method to unpin message
messageSchema.methods.unpin = function() {
  this.isPinned = false;
  this.pinnedAt = undefined;
  this.pinnedBy = undefined;
  
  return this.save();
};

// Static method to find messages by chat
messageSchema.statics.findByChat = function(chatId, options = {}) {
  const query = {
    chatId,
    isDeleted: false
  };
  
  const sort = { createdAt: -1 };
  const limit = options.limit || 50;
  const skip = options.skip || 0;
  
  if (options.before) {
    query.createdAt = { $lt: options.before };
  }
  
  if (options.after) {
    query.createdAt = { $gt: options.after };
  }
  
  return this.find(query)
    .populate('sender', 'name avatar')
    .populate('replyTo', 'content sender')
    .populate('readBy.user', 'name avatar')
    .populate('reactions.user', 'name avatar')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to find unread messages for user
messageSchema.statics.findUnreadForUser = function(chatId, userId) {
  return this.find({
    chatId,
    sender: { $ne: userId },
    isDeleted: false,
    'readBy.user': { $ne: userId }
  }).sort({ createdAt: -1 });
};

// Static method to search messages
messageSchema.statics.search = function(chatId, query, options = {}) {
  const searchQuery = {
    chatId,
    content: { $regex: query, $options: 'i' },
    isDeleted: false
  };
  
  const sort = { createdAt: -1 };
  const limit = options.limit || 20;
  const skip = options.skip || 0;
  
  return this.find(searchQuery)
    .populate('sender', 'name avatar')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

// Virtual for read count
messageSchema.virtual('readCount').get(function() {
  return this.readBy.length;
});

export default mongoose.model('Message', messageSchema);


