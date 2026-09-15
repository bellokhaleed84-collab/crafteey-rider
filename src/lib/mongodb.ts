import mongoose from "mongoose";

// Same MongoDB Atlas cluster and database as crafteey-client and
// crafteey-admin — this app reads/writes the same CourierRequest
// collection, just from the courier's side of the workflow.
//
// IMPORTANT: use the standard mongodb:// (non-SRV) connection string in
// MONGODB_URI, not mongodb+srv://, since SRV DNS lookups are blocked in
// this environment (same note as the other two apps).

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse the connection across hot reloads / serverless invocations.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
