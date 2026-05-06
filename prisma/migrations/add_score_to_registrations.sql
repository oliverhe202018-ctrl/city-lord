CREATE TABLE IF NOT EXISTS club_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location    TEXT,
  max_participants INT,
  start_time  TIMESTAMPTZ(6) NOT NULL,
  end_time    TIMESTAMPTZ(6) NOT NULL,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_activities_club_time
  ON club_activities(club_id, start_time ASC);

CREATE TABLE IF NOT EXISTS club_activity_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   UUID NOT NULL REFERENCES club_activities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  score         INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'registered',
  registered_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_car_club_activity
  ON club_activity_registrations(club_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_car_user_activity
  ON club_activity_registrations(user_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_car_activity_score
  ON club_activity_registrations(activity_id, score DESC);

ALTER TABLE club_activity_registrations ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;
