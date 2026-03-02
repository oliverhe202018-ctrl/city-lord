-- ============================================================
-- Migration: Add Club Activities & Registrations
-- Step 2: Activity Template Channel + Registration Skeleton
-- ============================================================

-- 1. Club Activities table
CREATE TABLE IF NOT EXISTS public.club_activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          UUID NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  location         TEXT,
  max_participants INTEGER,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  created_by       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_club_activities_club
    FOREIGN KEY (club_id)    REFERENCES public.clubs(id)    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_club_activities_creator
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Composite index for listing activities by club + start_time
CREATE INDEX IF NOT EXISTS idx_club_activities_club_time
  ON public.club_activities (club_id, start_time ASC);

-- 2. Club Activity Registrations table
CREATE TABLE IF NOT EXISTS public.club_activity_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   UUID NOT NULL,
  user_id       UUID NOT NULL,
  club_id       UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'registered'
                CHECK (status IN ('registered', 'canceled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_activity_reg_activity
    FOREIGN KEY (activity_id) REFERENCES public.club_activities(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_activity_reg_user
    FOREIGN KEY (user_id)     REFERENCES public.profiles(id)       ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_activity_reg_club
    FOREIGN KEY (club_id)     REFERENCES public.clubs(id)          ON DELETE CASCADE ON UPDATE NO ACTION,

  CONSTRAINT uq_user_activity UNIQUE (user_id, activity_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_activity_reg_club_activity
  ON public.club_activity_registrations (club_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_reg_user_activity
  ON public.club_activity_registrations (user_id, activity_id);

-- 3. Enable RLS (match project convention)
ALTER TABLE public.club_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_activity_registrations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read activities in their club
CREATE POLICY "Members can read club activities"
  ON public.club_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_activities.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- Allow all authenticated users to read registrations for activities they can see
CREATE POLICY "Members can read activity registrations"
  ON public.club_activity_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_activity_registrations.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );
