
-- Restore foreign key constraint for user_missions.mission_id
-- This is required for PostgREST resource embedding (joins) to work
ALTER TABLE user_missions
ADD CONSTRAINT user_missions_mission_id_fkey
FOREIGN KEY (mission_id)
REFERENCES missions(id)
ON DELETE CASCADE;
