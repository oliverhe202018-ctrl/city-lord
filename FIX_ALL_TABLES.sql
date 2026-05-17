-- 1. 紧急修补 missions 表 (添加缺失的列) 
ALTER TABLE missions 
ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 1; 
ALTER TABLE missions ADD COLUMN IF NOT EXISTS reward_amount INTEGER DEFAULT 0; 

-- 2. 紧急修补 rooms 表 (防止创建房间报错) 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_imports BOOLEAN DEFAULT true; 

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true; 

-- 3. 写入基础任务数据 (现在列已经存在了，这步一定会成功) 
INSERT INTO missions (id, title, description, type, reward_amount, target_count) 
VALUES 
('daily_login', '每日登录', '登录游戏即可获得奖励', 'daily', 100, 1), 
('daily_run_1km', '每日跑步1公里', '完成一次1公里的跑步', 'daily', 200, 1000), 
('weekly_run_5km', '周常挑战', '本周累计跑步5公里', 'weekly', 500, 5000) 
ON CONFLICT (id) DO UPDATE SET 
target_count = EXCLUDED.target_count, 
reward_amount = EXCLUDED.reward_amount; 

-- 4. 刷新缓存 
NOTIFY pgrst, 'reload schema';
