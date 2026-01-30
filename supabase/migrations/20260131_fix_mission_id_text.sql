-- Change mission_id to text to support string IDs like "1", "2"
ALTER TABLE user_missions ALTER COLUMN mission_id TYPE text;
