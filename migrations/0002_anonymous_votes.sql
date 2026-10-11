-- Vote intents from visitors without an account, kept apart from vote_intents.
-- Reported separately in /api/stats as unverified (may include bots).
-- Idempotent: the Function also creates this table on first request.
CREATE TABLE IF NOT EXISTS anon_vote_intents (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  election_id TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('red', 'blue', 'independent', 'undecided')),
  state TEXT NOT NULL,
  age_range TEXT,
  sex TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (visitor_id, election_id)
);
CREATE INDEX IF NOT EXISTS idx_anon_vote_intents_election_intent ON anon_vote_intents(election_id, intent);
