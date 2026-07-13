CREATE TABLE IF NOT EXISTS generation_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','skipped')),
  attempt SMALLINT NOT NULL DEFAULT 1 CHECK (attempt > 0),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  stage TEXT,
  topic TEXT,
  pr_url TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generation_runs_started_idx ON generation_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS generation_runs_status_idx ON generation_runs (status, started_at DESC);
