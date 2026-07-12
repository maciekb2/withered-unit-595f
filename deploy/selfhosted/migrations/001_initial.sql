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

CREATE TABLE IF NOT EXISTS social_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  source JSONB NOT NULL,
  package JSONB,
  status TEXT NOT NULL DEFAULT 'waiting_article' CHECK (status IN ('waiting_article','eligible','generating','review','queued','published','failed','skipped')),
  score SMALLINT,
  attempts SMALLINT NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_jobs_queue_idx ON social_jobs (status, scheduled_for, score DESC, created_at);

CREATE TABLE IF NOT EXISTS social_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES social_jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reel','instagram_post')),
  path TEXT NOT NULL,
  public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  checksum TEXT NOT NULL,
  bytes BIGINT NOT NULL CHECK (bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '60 days',
  UNIQUE(job_id, kind)
);

CREATE TABLE IF NOT EXISTS social_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES social_jobs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('instagram_reel','instagram_post','youtube_short')),
  buffer_draft_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','draft','queued','published','failed')),
  scheduled_for TIMESTAMPTZ,
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, channel)
);
