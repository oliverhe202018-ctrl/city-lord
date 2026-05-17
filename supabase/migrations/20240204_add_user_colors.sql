-- Add user color preferences to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS path_color TEXT DEFAULT '#3B82F6', -- Default Blue
ADD COLUMN IF NOT EXISTS fill_color TEXT DEFAULT '#3B82F6'; -- Default Blue
