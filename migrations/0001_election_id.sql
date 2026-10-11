-- Per-election vote intents.
-- Before: one vote_intents row per user (user_id UNIQUE), so a 2028 answer overwrote the 2026 one.
-- After:  one row per (user_id, election_id). Existing rows are kept as 'midterm-2026'.
-- Apply BEFORE deploying the Function that reads election_id:
--   npx wrangler d1 migrations apply election-countdown --remote

CREATE TABLE vote_intents_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  election_id TEXT NOT NULL DEFAULT 'midterm-2026',
  intent TEXT NOT NULL CHECK (intent IN ('red', 'blue', 'independent', 'undecided')),
  state TEXT NOT NULL,
  age_range TEXT,
  city TEXT,
  sex TEXT,
  custom_candidate TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, election_id)
);

INSERT INTO vote_intents_new (
  id, user_id, election_id, intent, state, age_range, city, sex, custom_candidate, created_at, updated_at
)
SELECT id, user_id, 'midterm-2026', intent, state, age_range, city, sex, custom_candidate, created_at, updated_at
FROM vote_intents;

DROP TABLE vote_intents;
ALTER TABLE vote_intents_new RENAME TO vote_intents;

CREATE INDEX IF NOT EXISTS idx_vote_intents_election_intent ON vote_intents(election_id, intent);
CREATE INDEX IF NOT EXISTS idx_vote_intents_election_state ON vote_intents(election_id, state);
CREATE INDEX IF NOT EXISTS idx_vote_intents_election_age ON vote_intents(election_id, age_range);

ALTER TABLE vote_intent_history ADD COLUMN election_id TEXT NOT NULL DEFAULT 'midterm-2026';
CREATE INDEX IF NOT EXISTS idx_vote_intent_history_user_election ON vote_intent_history(user_id, election_id, changed_at);
