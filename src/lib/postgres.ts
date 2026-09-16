import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool | null {
  if (!DATABASE_URL) return null;
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return global.__pgPool;
}

export const pgPool = getPool();

// Run this once against your Neon database (SQL Editor in the Neon
// console, or `psql $DATABASE_URL`) before location logging will actually
// persist anything — logLocationHistory fails silently (logs an error,
// doesn't throw) if this table doesn't exist yet, so a missing table
// won't break live tracking, it'll just mean no permanent history.
//
//   CREATE TABLE IF NOT EXISTS courier_location_history (
//     id BIGSERIAL PRIMARY KEY,
//     request_id TEXT NOT NULL,
//     courier_uid TEXT NOT NULL,
//     lat DOUBLE PRECISION NOT NULL,
//     lng DOUBLE PRECISION NOT NULL,
//     recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
//   );
//   CREATE INDEX IF NOT EXISTS idx_location_history_request
//     ON courier_location_history (request_id, recorded_at);

export async function logLocationHistory(params: {
  requestId: string;
  courierUid: string;
  lat: number;
  lng: number;
}) {
  const pool = pgPool;
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO courier_location_history (request_id, courier_uid, lat, lng)
       VALUES ($1, $2, $3, $4)`,
      [params.requestId, params.courierUid, params.lat, params.lng]
    );
  } catch (err) {
    console.error("Failed to log location history to Postgres:", err);
  }
}