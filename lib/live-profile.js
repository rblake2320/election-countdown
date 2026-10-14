// Use the existing countdown's event definitions and Eastern-time conversion.
import { ELECTIONS, parseAsEastern } from "../client/src/lib/elections.ts";

export const LIVE_PROFILE_SCHEMA = `CREATE TABLE IF NOT EXISTS live_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL,
  election_id TEXT NOT NULL,
  owner_zone TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
)`;

export async function readLiveProfile(env, userId) {
  return env.DB.prepare("SELECT * FROM live_profiles WHERE user_id = ?").bind(userId).first();
}

export function publicLiveProfile(row) {
  const event = ELECTIONS.find((e) => e.id === row.election_id);
  if (!event) throw new Error("Stored live profile has an unknown event");
  return {
    id: row.public_id, enabled: !!row.enabled, version: row.version,
    ownerZone: row.owner_zone, updatedAt: row.updated_at,
    event: { id: event.id, title: event.title, startMs: parseAsEastern(event.start).getTime(),
      endMs: parseAsEastern(event.end).getTime(), todayTitle: event.todayTitle },
    serverNowMs: Date.now(),
  };
}

export function privateLiveProfile(row) {
  return row ? { ...publicLiveProfile(row), reporterId: row.reporter_id } : null;
}

export async function saveLiveProfile(env, userId, input) {
  const allowed = new Set(["enabled", "electionId", "ownerZone", "reporterId", "version", "takeover"]);
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((k) => !allowed.has(k)) ||
      typeof input.enabled !== "boolean" || !ELECTIONS.some((e) => e.id === input.electionId) ||
      typeof input.ownerZone !== "string" || input.ownerZone.length > 80 ||
      typeof input.reporterId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(input.reporterId) ||
      !Number.isSafeInteger(input.version) || input.version < 0 ||
      (input.takeover !== undefined && typeof input.takeover !== "boolean")) {
    return { status: 400, body: { message: "Invalid live profile settings" } };
  }
  let zone;
  try { zone = new Intl.DateTimeFormat("en", { timeZone: input.ownerZone }).resolvedOptions().timeZone; }
  catch { return { status: 400, body: { message: "Unknown time zone" } }; }
  // One atomic compare-and-swap. The initial insert also requires version zero.
  const row = await env.DB.prepare(`
    INSERT INTO live_profiles (user_id, public_id, enabled, election_id, owner_zone, reporter_id, version, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, 1, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM live_profiles WHERE user_id = ?)
    ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled, election_id=excluded.election_id,
      owner_zone=excluded.owner_zone, reporter_id=excluded.reporter_id,
      version=live_profiles.version+1, updated_at=excluded.updated_at
    WHERE live_profiles.version = ? AND (live_profiles.reporter_id = excluded.reporter_id OR ? = 1)
    RETURNING *
  `).bind(userId, crypto.randomUUID(), input.enabled ? 1 : 0, input.electionId, zone,
    input.reporterId, new Date().toISOString(), input.version, userId, input.version, input.takeover ? 1 : 0).first();
  return row
    ? { status: 200, body: privateLiveProfile(row) }
    : { status: 409, body: { message: "Settings changed or another device is reporting. Reload before retrying." } };
}
