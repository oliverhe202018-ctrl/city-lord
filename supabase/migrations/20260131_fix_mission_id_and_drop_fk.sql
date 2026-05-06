-- Drop the foreign key constraint that prevents changing the type
ALTER TABLE user_missions DROP CONSTRAINT IF EXISTS user_missions_mission_id_fkey;

-- Change mission_id to text to support string IDs like "1", "2"
ALTER TABLE user_missions ALTER COLUMN mission_id TYPE text;
