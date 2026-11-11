import mongoose from 'mongoose';

export const pairKeyFor = (userA, userB) => [String(userA), String(userB)].sort().join(':');

// Snapshot of the newest message, embedded so the chat list needs no extra query.
const lastMessageSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    text: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: Date,
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (ids) => ids.length === 2 && String(ids[0]) !== String(ids[1]),
        message: 'A chat needs exactly two different participants',
      },
    },
    // Sorted "idA:idB". The unique index makes duplicate chats impossible, even under races.
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { type: lastMessageSchema, default: undefined },
    // userId -> unread message count for that user.
    unread: { type: Map, of: Number, default: () => ({}) },
    lastReadAt: { type: Map, of: Date, default: () => ({}) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1, updatedAt: -1 });

/** Finds the direct chat between two users, creating it if it does not exist. */
chatSchema.statics.getOrCreateDirect = async function getOrCreateDirect(userA, userB) {
  const pairKey = pairKeyFor(userA, userB);
  const existing = await this.findOne({ pairKey });
  if (existing) return existing;

  try {
    return await this.create({
      participants: [userA, userB],
      pairKey,
      unread: { [String(userA)]: 0, [String(userB)]: 0 },
    });
  } catch (error) {
    // Another request created it between our read and write.
    if (error.code === 11000) return this.findOne({ pairKey });
    throw error;
  }
};

export default mongoose.model('Chat', chatSchema);
