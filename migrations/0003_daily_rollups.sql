-- Pre-aggregated daily metrics (UTC days), written by the nightly Worker and by
-- POST /api/admin/rollup?day=. Idempotent.
CREATE TABLE IF NOT EXISTS daily_rollups (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  dimension TEXT NOT NULL,
  value INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (day, metric, dimension)
);
