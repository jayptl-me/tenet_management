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

  throw new Error('Failed to connect to MongoDB after 3 attempts — check MONGODB_URI and network');
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}
