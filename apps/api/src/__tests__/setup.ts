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
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let memoryServer: MongoMemoryReplSet | null = null;

beforeAll(async () => {
  let uri = process.env.MONGODB_URI_TEST;

  if (!uri) {
    // Replica set is required for session.withTransaction() support
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    uri = memoryServer.getUri();
  }

  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
  });
});

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
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
});
