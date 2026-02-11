-- 创建触发器：当 club_members.status 变为 active 时，自动更新 profiles.club_id
CREATE OR REPLACE FUNCTION sync_profile_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果状态变为 active，更新 profile
  IF NEW.status = 'active' THEN
    UPDATE profiles
    SET club_id = NEW.club_id,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  -- 如果状态变为 rejected 或 left，清除 profile.club_id
  IF NEW.status IN ('rejected', 'left') THEN
    UPDATE profiles
    SET club_id = NULL,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 club_members 表
DROP TRIGGER IF EXISTS trigger_sync_profile_club_id ON club_members;

CREATE TRIGGER trigger_sync_profile_club_id
AFTER INSERT OR UPDATE OF status ON club_members
FOR EACH ROW
EXECUTE FUNCTION sync_profile_club_id();
