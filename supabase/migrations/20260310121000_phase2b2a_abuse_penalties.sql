-- Migration for Phase 2B-2A: Anti-Abuse Penalty Logs

CREATE TABLE IF NOT EXISTS territory_reward_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id VARCHAR(50) NOT NULL,
  claim_event_id BIGINT NOT NULL,
  attacker_user_id UUID NOT NULL,
  attacker_club_id UUID,
  defender_user_id UUID,
  matched_rule VARCHAR(100) NOT NULL,
  applied_ratio NUMERIC(5,2) NOT NULL,
  reason_window VARCHAR(50) NOT NULL,
  source_event_ids JSONB,
  penalty_enabled_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  reward_payload_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_penalties_territory ON territory_reward_penalties(territory_id);
CREATE INDEX IF NOT EXISTS idx_reward_penalties_attacker ON territory_reward_penalties(attacker_user_id);
CREATE INDEX IF NOT EXISTS idx_reward_penalties_created ON territory_reward_penalties(created_at);

-- Adding comment for table
COMMENT ON TABLE territory_reward_penalties IS 'Audit logs for Phase 2B-2A territory reward abuse penalties (Anti-Abuse System)';
