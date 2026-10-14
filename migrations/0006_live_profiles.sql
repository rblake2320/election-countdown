CREATE TABLE IF NOT EXISTS live_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL,
  election_id TEXT NOT NULL,
  owner_zone TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
