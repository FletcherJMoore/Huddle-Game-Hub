// Postgres connection pool. The whole app shares one pool; connection details
// come entirely from DATABASE_URL (which already includes the password), so
// there's no separate password variable to keep in sync.

import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. On Railway, add it to the backend service as ${{Postgres.DATABASE_URL}}."
  );
}

// Railway's private network (postgres.railway.internal) speaks plaintext; the
// public proxy (proxy.rlwy.net) requires TLS but presents a cert `pg` won't
// verify by default. Local Postgres also needs no TLS. So: enable TLS (without
// verification) only when talking to a remote host over the public proxy.
function needsSsl(cs) {
  if (process.env.PGSSLMODE === "disable" || /sslmode=disable/.test(cs)) return false;
  if (/\.railway\.internal/.test(cs)) return false;
  if (/@(localhost|127\.0\.0\.1)/.test(cs)) return false;
  return true;
}

export const pool = new Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false
});

export function query(text, params) {
  return pool.query(text, params);
}
