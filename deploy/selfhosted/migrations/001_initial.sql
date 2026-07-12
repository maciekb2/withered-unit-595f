-- PostgreSQL foundation for the self-hosted runtime.
-- Content publication remains file/Git based; these tables replace D1/KV state.
CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL DEFAULT now(),
  worker_id TEXT NOT NULL,
  data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS logs_time_idx ON logs (time DESC);
CREATE INDEX IF NOT EXISTS logs_data_type_idx ON logs ((data->>'type'));

CREATE TABLE IF NOT EXISTS engagement_counters (
  kind TEXT NOT NULL CHECK (kind IN ('view', 'like')),
  slug TEXT NOT NULL,
  value BIGINT NOT NULL DEFAULT 0 CHECK (value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, slug)
);

CREATE TABLE IF NOT EXISTS engagement_like_sessions (
  slug TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, session_id)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
