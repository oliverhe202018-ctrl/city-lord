-- Relax territory_events constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'check_valid_event_type' AND table_name = 'territory_events'
    ) THEN
        ALTER TABLE territory_events DROP CONSTRAINT check_valid_event_type;
    END IF;
END $$;
