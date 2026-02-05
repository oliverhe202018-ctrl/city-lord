-- Check if is_public column exists in clubs table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clubs' AND column_name = 'is_public';
