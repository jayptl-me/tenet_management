/**
 * Test setup — connects to a test MongoDB database.
 * Uses MONGODB_URI_TEST env var if provided (CI / local mongod).
 * Otherwise spins up an in-memory MongoDB replica set via
 * mongodb-memory-server so transactions (session.withTransaction)
 * work without any external database dependency.
 * Cleans all collections between test suites.
 */
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';

let memoryReplSet: MongoMemoryReplSet | null = null;
let memoryServer: MongoMemoryServer | null = null;

beforeAll(async () => {
  let uri = process.env.MONGODB_URI_TEST;

  if (!uri) {
    // MONGO_MEMORY_SIMPLE=1: single-node (faster; no multi-doc transactions).
    // Default: replica set for session.withTransaction(); fall back to single-node if ReplSet fails.
    const simple = process.env.MONGO_MEMORY_SIMPLE === '1';
    if (simple) {
      memoryServer = await MongoMemoryServer.create({
        instance: { launchTimeout: 90_000 },
      });
      uri = memoryServer.getUri();
    } else {
      try {
        memoryReplSet = await MongoMemoryReplSet.create({
          replSet: { count: 1, storageEngine: 'wiredTiger' },
          instanceOpts: [{ launchTimeout: 90_000 }],
        });
        uri = memoryReplSet.getUri();
      } catch {
        memoryServer = await MongoMemoryServer.create({
          instance: { launchTimeout: 90_000 },
        });
        uri = memoryServer.getUri();
      }
    }
  }

  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 30_000,
  });
}, 180_000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  if (collections) {
    for (const key of Object.keys(collections)) {
      const coll = collections[key];
      if (coll) await coll.deleteMany({});
    }
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (memoryReplSet) {
    await memoryReplSet.stop();
    memoryReplSet = null;
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
});
