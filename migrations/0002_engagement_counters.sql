CREATE TABLE IF NOT EXISTS engagement_counters (
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, slug)
);

CREATE TABLE IF NOT EXISTS engagement_like_sessions (
  slug TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (slug, session_id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_counters_kind
  ON engagement_counters (kind);

CREATE INDEX IF NOT EXISTS idx_engagement_like_sessions_created_at
  ON engagement_like_sessions (created_at);
