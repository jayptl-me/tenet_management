/**
 * MongoDB connection manager — single shared connection.
 *
 * Architecture: ONE mongoose instance per process.
 * All route handlers, models, and services share this single connection pool.
 * No request opens its own connection. This is the production-grade pattern.
 *
 * Atlas free tier (M0) optimal pool size: 5–10 connections.
 */
import mongoose from 'mongoose';
import logger from './logger.js';
import { env } from './env.js';

let isConnected = false;

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function connectDatabase(): Promise<void> {
  if (isDatabaseConnected()) {
    logger.info('Database already connected');
    return;
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Single connection — all models/routes share this pool
      await mongoose.connect(env.MONGODB_URI, {
        // Atlas free tier optimal pool: small footprint
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        // Retry once on transient write errors
        retryWrites: true,
        // Use majority write concern for data safety
        w: 'majority',
      });

      mongoose.connection.on('connected', () => {
        isConnected = true;
        logger.info('MongoDB connected');
      });

      mongoose.connection.on('disconnected', () => {
        isConnected = false;
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('error', (err) => {
        isConnected = false;
        logger.error({ err }, 'MongoDB connection error');
      });

      isConnected = true;
      logger.info({ attempt, poolSize: 10 }, 'MongoDB connected successfully');
      return;
    } catch (error) {
      logger.error({ err: error, attempt }, `MongoDB connection attempt ${attempt} failed`);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.warn('Remote Atlas MongoDB unavailable. Starting local MongoMemoryServer fallback...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      isConnected = true;
      logger.info({ uri }, 'Local MongoMemoryServer connected successfully');

      // Auto-seed admin user and config in memory server
      const { User } = await import('../models/user.js');
      const { AppConfig } = await import('../models/appConfig.js');

      const existingAdmin = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
      if (!existingAdmin) {
        await User.create({
          name: env.ADMIN_NAME,
          email: env.ADMIN_EMAIL,
          phone: env.ADMIN_PHONE,
          passwordHash: env.ADMIN_PASSWORD,
          role: 'admin',
        });
      }

      const existingConfig = await AppConfig.findOne();
      if (!existingConfig) {
        await AppConfig.create({
          pgName: 'Sunrise PG',
          tagline: 'Your home, your space.',
          address: {
            line1: '42 MG Road',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
          },
          phone: '+919876543210',
          email: 'hello@sunrisepg.in',
        });
      }

      return;
    } catch (memErr: unknown) {
      logger.error({ err: memErr }, 'MongoMemoryServer fallback failed');
    }
  }

  throw new Error('Failed to connect to MongoDB after 3 attempts — check MONGODB_URI and network');
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}
