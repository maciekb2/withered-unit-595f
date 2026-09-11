-- Backward-compatible; review through the release migration gate before promotion.
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS submission_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS contact_messages_submission_id_idx ON contact_messages (submission_id);
CREATE TABLE IF NOT EXISTS contact_rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK (hits > 0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS contact_rate_limits_expires_idx ON contact_rate_limits (expires_at);
