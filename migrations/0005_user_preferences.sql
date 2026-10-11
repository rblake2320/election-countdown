-- Appearance preferences (theme, number style) for verified accounts.
-- The Function adds this column itself if missing, so applying this is idempotent in practice;
-- wrangler records it so it is not attempted twice.
ALTER TABLE users ADD COLUMN preferences_json TEXT;
