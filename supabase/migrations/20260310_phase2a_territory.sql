-- Migration for Phase 2A Territory Model

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'territories' 
    AND column_name = 'owner_club_id'
  ) THEN
    ALTER TABLE territories ADD COLUMN owner_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'territories' 
    AND column_name = 'owner_faction'
  ) THEN
    ALTER TABLE territories ADD COLUMN owner_faction VARCHAR(50);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_territories_club ON territories(owner_club_id);
CREATE INDEX IF NOT EXISTS idx_territories_faction ON territories(owner_faction);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'check_valid_faction' AND table_name = 'territories'
    ) THEN
        ALTER TABLE territories
        ADD CONSTRAINT check_valid_faction CHECK (
          owner_faction IS NULL OR 
          owner_faction IN ('cyberpunk', 'steampunk', 'bio', 'alien')
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS territory_events (
  id BIGSERIAL PRIMARY KEY,
  territory_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  user_id UUID,
  old_owner_id UUID,
  new_owner_id UUID,
  old_club_id UUID,
  new_club_id UUID,
  old_faction VARCHAR(50),
  new_faction VARCHAR(50),
  source_request_id UUID,
  action_id VARCHAR(100),
  processed_for_stats BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processor_version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_events_territory ON territory_events(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_events_unprocessed ON territory_events(processed_for_stats) WHERE processed_for_stats = FALSE;
CREATE INDEX IF NOT EXISTS idx_territory_events_req ON territory_events(source_request_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'check_valid_event_type' AND table_name = 'territory_events'
    ) THEN
        ALTER TABLE territory_events
        ADD CONSTRAINT check_valid_event_type CHECK (
          event_type IN ('CLAIM')
        );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_territory_events_idempotency ON territory_events(territory_id, source_request_id) WHERE source_request_id IS NOT NULL;
