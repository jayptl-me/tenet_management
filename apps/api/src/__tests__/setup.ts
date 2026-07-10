/**
 * Test setup — connects to a test MongoDB database.
 * Uses MONGODB_URI_TEST env var or falls back to local mongodb.
 * Cleans all collections between test suites.
 */
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

const TEST_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://localhost:27017/pg_management_test';

beforeAll(async () => {
  await mongoose.connect(TEST_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
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
});
