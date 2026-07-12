CREATE TABLE IF NOT EXISTS social_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL UNIQUE CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','uploading','ready','processing','review','failed')),
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  notified_at TIMESTAMPTZ,
  feedback_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE social_runs ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE social_runs ADD COLUMN IF NOT EXISTS feedback_notified_at TIMESTAMPTZ;

ALTER TABLE social_jobs DROP CONSTRAINT IF EXISTS social_jobs_status_check;
ALTER TABLE social_jobs ADD CONSTRAINT social_jobs_status_check CHECK (
  status IN ('candidate','selected','ready','generating','review','queued','published','failed','skipped','waiting_article','eligible')
);
ALTER TABLE social_jobs ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES social_runs(id) ON DELETE SET NULL;
ALTER TABLE social_jobs ADD COLUMN IF NOT EXISTS master_image_path TEXT;
ALTER TABLE social_jobs ADD COLUMN IF NOT EXISTS variant_key TEXT;
ALTER TABLE social_jobs ADD COLUMN IF NOT EXISTS prompt_version TEXT;
ALTER TABLE social_jobs ALTER COLUMN status SET DEFAULT 'candidate';

CREATE TABLE IF NOT EXISTS social_metric_snapshots (
  id BIGSERIAL PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES social_publications(id) ON DELETE CASCADE,
  window_hours SMALLINT NOT NULL CHECK (window_hours IN (24,72,168,672)),
  provider TEXT NOT NULL CHECK (provider IN ('buffer','youtube','ga4')),
  metrics JSONB NOT NULL,
  normalized_score NUMERIC(10,4),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(publication_id, window_hours, provider)
);

ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS platform_post_id TEXT;
ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS variant_key TEXT;
ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;
