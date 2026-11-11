import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export const HANDLE_REGEX = /^[a-z0-9_.]{3,20}$/;
export const MAX_INTERESTS = 10;
export const MAX_LANGUAGES = 5;

const normalizeList = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))]
    : value;

const userSchema = new mongoose.Schema(
  {
    handle: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [HANDLE_REGEX, 'Handle must be 3-20 characters: letters, numbers, dot or underscore'],
    },
    displayName: { type: String, trim: true, maxlength: [50, 'Name is too long (max 50)'], default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    bio: { type: String, trim: true, maxlength: [160, 'Bio is too long (max 160)'], default: '' },
    avatar: { type: String, trim: true, maxlength: [16, 'Avatar is too long'], default: '🙂' },
    interests: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: [20, 'Interest is too long (max 20)'] }],
      set: normalizeList,
      validate: {
        validator: (list) => list.length <= MAX_INTERESTS,
        message: `At most ${MAX_INTERESTS} interests`,
      },
      default: [],
    },
    languages: {
      type: [{ type: String, lowercase: true, match: [/^[a-z]{2,3}$/, 'Invalid language code'] }],
      set: normalizeList,
      validate: {
        validator: (list) => list.length <= MAX_LANGUAGES,
        message: `At most ${MAX_LANGUAGES} languages`,
      },
      default: [],
    },
    city: { type: String, required: true, trim: true },
    area: { type: String, trim: true, maxlength: [40, 'Area is too long (max 40)'], default: '' },
    ageConfirmed: { type: Boolean, required: true },
    preferences: {
      language: { type: String, enum: ['en', 'hi'], default: 'en' },
      notifications: { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true },
      showLastSeen: { type: Boolean, default: true },
    },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    banExpiresAt: Date,
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ city: 1, area: 1 });
userSchema.index({ interests: 1 });

userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 10);

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

/** A ban is active when flagged and either permanent or not yet expired. */
userSchema.methods.isBannedNow = function isBannedNow() {
  if (!this.isBanned) return false;
  return !this.banExpiresAt || this.banExpiresAt > new Date();
};

export default mongoose.model('User', userSchema);
