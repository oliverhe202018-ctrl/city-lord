-- Migration for individual view territory report feature
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Create the territory_reports table
CREATE TABLE IF NOT EXISTS territory_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  territory_id TEXT NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies for territory_reports
ALTER TABLE territory_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can view their own reports
CREATE POLICY "Users can view their own territory reports"
  ON territory_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Reporters can create new reports
CREATE POLICY "Users can create territory reports"
  ON territory_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Only admins can update reports (handled by service role in backend, but adding policy for completeness if needed)
-- CREATE POLICY "Admins can update reports" ON territory_reports FOR UPDATE USING (is_admin(auth.uid()));

-- Index for quick lookups by reporter or territory
CREATE INDEX IF NOT EXISTS idx_territory_reports_reporter_id ON territory_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_territory_reports_territory_id ON territory_reports(territory_id);

-- CRITICAL: Prevent duplicate PENDING reports for the same territory by the same user
-- This requires a partial unique index, enforced by Postgres at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_territory_report 
  ON territory_reports (reporter_id, territory_id) 
  WHERE status = 'PENDING';

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at_territory_reports
  BEFORE UPDATE ON territory_reports
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime (updated_at);
