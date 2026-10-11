CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  ec_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  is_fully_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  trust_score INTEGER NOT NULL DEFAULT 0,
  flagged_as_bot INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vote_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL CHECK (intent IN ('red', 'blue', 'independent', 'undecided')),
  state TEXT NOT NULL,
  age_range TEXT,
  city TEXT,
  sex TEXT,
  custom_candidate TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vote_intent_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  previous_intent TEXT,
  new_intent TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT NOT NULL,
  previous_payload_json TEXT,
  new_payload_json TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  path TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS verification_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  provider TEXT,
  provider_ref TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_vote_intents_state ON vote_intents(state);
CREATE INDEX IF NOT EXISTS idx_vote_intents_age ON vote_intents(age_range);
CREATE INDEX IF NOT EXISTS idx_vote_intents_intent ON vote_intents(intent);
CREATE INDEX IF NOT EXISTS idx_vote_intent_history_user ON vote_intent_history(user_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type_created ON tracking_events(event_type, created_at);
