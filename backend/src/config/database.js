import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Redis from 'redis';

dotenv.config();

// MongoDB Connection
export const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/textsy';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Redis Connection
export const createRedisClient = () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    const client = Redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('❌ Redis server refused connection');
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('❌ Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          console.error('❌ Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });
    
    client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
    
    client.on('error', (error) => {
      console.error('❌ Redis error:', error);
    });
    
    client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
    
    client.on('end', () => {
      console.log('⚠️  Redis connection ended');
    });
    
    return client;
    
  } catch (error) {
    console.error('❌ Redis client creation failed:', error);
    return null;
  }
};

// Graceful shutdown for Redis
export const closeRedisClient = async (client) => {
  if (client) {
    try {
      await client.quit();
      console.log('Redis client closed');
    } catch (error) {
      console.error('Error closing Redis client:', error);
    }
  }
};
