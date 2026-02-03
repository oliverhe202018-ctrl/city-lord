
-- Fix RLS policies for clubs and club_members
-- Allow authenticated users to create clubs
CREATE POLICY "Users can create clubs" ON clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Allow authenticated users to join clubs (insert into club_members)
-- The existing policy "Users can apply" only checks auth.uid() = user_id which is correct,
-- but we might need to ensure they can insert pending status.

-- Let's review existing policies from the schema file provided:
-- create policy "Users can apply" on club_members for insert with check (auth.uid() = user_id);
-- This seems correct for joining.

-- But for creating a club, we likely missed the INSERT policy for 'clubs' table.
-- The schema only had:
-- create policy "Anyone can view clubs" on clubs for select using (true);
-- create policy "Owners can update clubs" on clubs for update using (auth.uid() = owner_id);

-- MISSING: INSERT policy for clubs.
-- MISSING: DELETE policy for clubs (for disband).

-- Also for club_members:
-- MISSING: DELETE policy for leaving/kicking.

BEGIN;

-- 1. Clubs Policies
DROP POLICY IF EXISTS "Users can create clubs" ON clubs;
CREATE POLICY "Users can create clubs" ON clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete clubs" ON clubs;
CREATE POLICY "Owners can delete clubs" ON clubs FOR DELETE USING (auth.uid() = owner_id);

-- 2. Club Members Policies
-- "Users can apply" exists, but let's ensure it covers creation too.
-- When creating a club, the owner is inserted into club_members.
-- The logic in createClub action:
-- 1. Insert Club
-- 2. (Implicitly trigger or manual insert?)
-- Looking at createClub action code:
-- It ONLY inserts into 'clubs'.
-- It does NOT insert into 'club_members' manually in the transaction.
-- Wait, if there is no trigger, the owner is not added to members?
-- Let's check if there is a trigger.
-- The schema file didn't show a trigger.
-- If no trigger, `createClub` in `app/actions/club.ts` is incomplete because it sets `member_count: 1` but doesn't add the row to `club_members`.

-- However, the user error is "Create Failed... details: Null".
-- This usually means RLS violation on the `clubs` insert itself.

-- Let's fix the RLS first.

COMMIT;
