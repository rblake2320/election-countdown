// Shared analytics for the API (on demand) and the nightly Worker (scheduled).
// Plain JS with no dependencies: bundled into both functions/api and workers/nightly.

export const ROLLUP_TABLE_SQL = `CREATE TABLE IF NOT EXISTS daily_rollups (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  dimension TEXT NOT NULL,
  value INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (day, metric, dimension)
)`;

export function isDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

/** UTC bounds of a day as ISO strings, matching how every table stores created_at. */
export function dayBounds(day) {
  const start = new Date(day + "T00:00:00.000Z");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return [start.toISOString(), end.toISOString()];
}

export function previousUtcDay(atMs) {
  return new Date(atMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// metric -> SQL returning (dimension, value) for created_at in [?1, ?2).
const METRICS = {
  events: `SELECT event_type AS dimension, COUNT(*) AS value FROM tracking_events
           WHERE created_at >= ?1 AND created_at < ?2 GROUP BY event_type`,
  unique_visitors: `SELECT 'all' AS dimension, COUNT(DISTINCT ip_hash) AS value FROM tracking_events
           WHERE created_at >= ?1 AND created_at < ?2 AND ip_hash != ''`,
  active_users: `SELECT 'all' AS dimension, COUNT(DISTINCT user_id) AS value FROM tracking_events
           WHERE created_at >= ?1 AND created_at < ?2 AND user_id IS NOT NULL`,
  new_accounts: `SELECT 'all' AS dimension, COUNT(*) AS value FROM users
           WHERE created_at >= ?1 AND created_at < ?2`,
  new_votes: `SELECT election_id || '|' || intent AS dimension, COUNT(*) AS value FROM vote_intents
           WHERE created_at >= ?1 AND created_at < ?2 GROUP BY election_id, intent`,
  vote_changes: `SELECT election_id AS dimension, COUNT(*) AS value FROM vote_intent_history
           WHERE changed_at >= ?1 AND changed_at < ?2 AND previous_intent IS NOT NULL GROUP BY election_id`,
  new_anon_votes: `SELECT election_id || '|' || intent AS dimension, COUNT(*) AS value FROM anon_vote_intents
           WHERE created_at >= ?1 AND created_at < ?2 GROUP BY election_id, intent`,
  flips_to: `SELECT COALESCE(json_extract(payload_json, '$.toYear'), 'unknown') AS dimension, COUNT(*) AS value
           FROM tracking_events WHERE created_at >= ?1 AND created_at < ?2 AND event_type = 'flip'
           GROUP BY dimension`
};

/** Recomputes one UTC day's rollup rows (idempotent: replaces that day). */
export async function computeDailyRollup(db, day) {
  if (!isDay(day)) throw new Error("day must be YYYY-MM-DD");
  await db.prepare(ROLLUP_TABLE_SQL).run();
  const [from, to] = dayBounds(day);
  const computedAt = new Date().toISOString();
  const rows = [];
  for (const [metric, sql] of Object.entries(METRICS)) {
    const result = await db.prepare(sql).bind(from, to).all();
    for (const row of result.results || []) {
      if (row.value > 0) rows.push({ day, metric, dimension: String(row.dimension), value: Number(row.value) });
    }
  }
  await db.batch([
    db.prepare("DELETE FROM daily_rollups WHERE day = ?").bind(day),
    ...rows.map((r) =>
      db.prepare("INSERT INTO daily_rollups (day, metric, dimension, value, computed_at) VALUES (?, ?, ?, ?, ?)")
        .bind(r.day, r.metric, r.dimension, r.value, computedAt))
  ]);
  return rows;
}

export async function readRollups(db, from, to, metric) {
  await db.prepare(ROLLUP_TABLE_SQL).run();
  const where = ["day >= ?", "day <= ?"];
  const params = [from, to];
  if (metric) { where.push("metric = ?"); params.push(metric); }
  const result = await db.prepare(
    `SELECT day, metric, dimension, value FROM daily_rollups WHERE ${where.join(" AND ")} ORDER BY day, metric, dimension`
  ).bind(...params).all();
  return result.results || [];
}

const PAGE = 5000;

async function pagedRows(db, sql, params) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const result = await db.prepare(`${sql} LIMIT ${PAGE} OFFSET ${offset}`).bind(...params).all();
    const rows = result.results || [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/**
 * Raw data for one day as NDJSON strings. Emails, user agents and raw IPs are never included:
 * accounts appear by ec_id, visitors by their hashed IP / random visitor id.
 */
export async function buildDailyDump(db, day) {
  const [from, to] = dayBounds(day);
  const events = await pagedRows(db,
    `SELECT id, event_type, user_id, payload_json, path, referrer, ip_hash, created_at
     FROM tracking_events WHERE created_at >= ? AND created_at < ? ORDER BY created_at, id`, [from, to]);
  // Vote tables are small; dump a full snapshot so each day's file stands alone.
  const votes = await pagedRows(db,
    `SELECT v.id, v.election_id, u.ec_id, v.intent, v.state, v.age_range, v.city, v.sex,
            v.custom_candidate, v.created_at, v.updated_at
     FROM vote_intents v JOIN users u ON u.id = v.user_id ORDER BY v.created_at, v.id`, []);
  const anonVotes = await pagedRows(db,
    `SELECT id, visitor_id, election_id, intent, state, age_range, sex, ip_hash, created_at, updated_at
     FROM anon_vote_intents ORDER BY created_at, id`, []);
  const ndjson = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  return {
    counts: { events: events.length, votes: votes.length, anonVotes: anonVotes.length },
    files: {
      "events.ndjson": ndjson(events),
      "votes.ndjson": ndjson(votes),
      "anon_votes.ndjson": ndjson(anonVotes)
    }
  };
}
