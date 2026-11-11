import mongoose from 'mongoose';
import User from '../models/User.js';

export const connectMongoDB = async (uri) => {
  mongoose.connection.on('error', (error) => console.error('MongoDB error:', error));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

  await mongoose.connect(uri);
  // Make sure unique indexes exist before accepting traffic.
  await mongoose.connection.syncIndexes();

  // Presence lives in memory, so after a restart nobody is connected yet.
  await User.updateMany({ isOnline: true }, { $set: { isOnline: false } });
};

export const closeMongoDB = () => mongoose.connection.close();
