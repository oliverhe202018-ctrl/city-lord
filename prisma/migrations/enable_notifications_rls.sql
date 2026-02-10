-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own notifications
CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to update their own notifications (e.g. mark as read)
CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Note: Service Role (Edge Functions) bypasses RLS by default, so INSERT policy is not strictly required if using service_role key.
-- But for completeness, if we wanted to allow authenticated users to insert (which we usually don't for system notifications), we would add that here.
-- For now, we rely on Service Role for INSERTs.
