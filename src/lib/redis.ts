import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined | null;
}

// Reuse one connection across requests/hot-reloads instead of opening a
// new one every time. Wrapped in try/catch because `new Redis(url)`
// parses the connection string synchronously with `new URL(...)` — a
// malformed REDIS_URL throws immediately, and since Next.js imports every
// route module during the BUILD (to collect page data), an unguarded
// throw here crashes the entire deployment, not just a request at
// runtime. lazyConnect also avoids opening an actual TCP connection
// during that build-time import.
function getRedisClient(): Redis | null {
  if (!REDIS_URL) return null;
  if (global.__redisClient === undefined) {
    try {
      const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
      client.on("error", (err) => {
        console.error("Redis connection error:", err.message);
      });
      global.__redisClient = client;
    } catch (err) {
      console.error("Failed to construct Redis client — check REDIS_URL format:", err);
      global.__redisClient = null;
    }
  }
  return global.__redisClient;
}

export const redis = getRedisClient();

// A live position is only trusted for this long without a fresh ping. If
// the rider's GPS/network drops, this key simply expires on its own —
// that's the mechanism for handling GPS permission loss / network loss:
// no explicit "rider went offline" event needed, reads just stop finding
// a live entry and fall back to the last known position.
const LIVE_LOCATION_TTL_SECONDS = 30;

export interface LiveLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

export async function setLiveLocation(requestId: string, loc: { lat: number; lng: number }) {
  if (!redis) return;
  const payload: LiveLocation = { ...loc, updatedAt: Date.now() };
  try {
    await redis.set(
      `rider:location:${requestId}`,
      JSON.stringify(payload),
      "EX",
      LIVE_LOCATION_TTL_SECONDS
    );
  } catch (err) {
    console.error("Failed to write live location to Redis:", err);
  }
}

export async function getLiveLocation(requestId: string): Promise<LiveLocation | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(`rider:location:${requestId}`);
    if (!raw) return null;
    return JSON.parse(raw) as LiveLocation;
  } catch (err) {
    console.error("Failed to read live location from Redis:", err);
    return null;
  }
}

export async function clearLiveLocation(requestId: string) {
  if (!redis) return;
  try {
    await redis.del(`rider:location:${requestId}`);
  } catch {
    // Non-critical — the TTL clears it on its own regardless.
  }
}