-- 1. 添加邀请码字段 (如果不存在) 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS invite_code TEXT; 

-- 2. 创建自动生成邀请码的函数 (简单的 6 位随机码) 
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS TRIGGER AS $$ 
BEGIN 
  IF NEW.invite_code IS NULL THEN 
    NEW.invite_code := upper(substring(md5(random()::text), 1, 6)); 
  END IF; 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql; 

-- 3. 绑定触发器 (在插入前自动生成) 
DROP TRIGGER IF EXISTS set_invite_code ON rooms; 
CREATE TRIGGER set_invite_code BEFORE INSERT ON rooms FOR EACH ROW EXECUTE FUNCTION generate_invite_code();
