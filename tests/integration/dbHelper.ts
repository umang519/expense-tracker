import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer | null = null;

// lib/db.ts reads MONGODB_URI at module-load time, so callers must set this
// (via startTestDb, before dynamically importing anything under lib/) rather
// than connecting to a real Atlas cluster.
export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
  mongod = null;
}

export async function clearTestDb(): Promise<void> {
  const { connections } = mongoose;
  for (const conn of connections) {
    if (!conn.db) continue;
    const collections = await conn.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
}
