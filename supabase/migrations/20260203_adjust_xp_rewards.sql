
-- 调整任务经验奖励以匹配等级系统
-- 等级系统分析：
-- Wanderer (Lv 1-5): ~400 XP/level
-- Citizen (Lv 6-15): ~800 XP/level
-- Knight (Lv 16-30): ~2666 XP/level
-- Baron (Lv 31-50): ~5000 XP/level

-- 策略：
-- 每日任务：应提供能让低等级玩家（Lv 1-5）有明显进度感（如 10%-20%），但对高等级玩家不至于溢出的经验。
-- 每日任务总和建议在 300-500 XP 左右（接近升一级的量，鼓励新手留存）。
-- 每周任务：应相当于每日任务的 3-5 倍。
-- 成就任务：应给予大量奖励。

-- 具体调整：
-- 1. 每日开跑 (Daily Run): 50 -> 100 XP (约 Lv1 的 25%)
-- 2. 每日3公里 (Daily 3km): 100 -> 200 XP (约 Lv1 的 50%)
-- 3. 领地扩张 (Daily Hex): 80 -> 150 XP (约 Lv1 的 37.5%)
--   -> 每日总计: 450 XP (新手每天能升一级多，非常爽快)

-- 4. 周跑者 (Weekly 15km): 500 -> 800 XP
-- 5. 夜行侠 (Weekly Night): 400 -> 600 XP
-- 6. 活跃跑者 (Weekly Active): 300 -> 500 XP
--   -> 每周总计: 1900 XP

-- 7. 初次启程 (Achievement): 200 -> 500 XP (直接升一级)
-- 8. 累计马拉松 (Achievement): 2000 -> 5000 XP (巨额奖励)
-- 9. 大地主 (Achievement): 5000 -> 10000 XP

UPDATE public.missions
SET reward_experience = CASE id
    WHEN 'daily_run_1' THEN 100
    WHEN 'daily_dist_3' THEN 200
    WHEN 'daily_hex_10' THEN 150
    WHEN 'weekly_dist_15' THEN 800
    WHEN 'weekly_night_3' THEN 600
    WHEN 'weekly_active_3' THEN 500
    WHEN 'ach_first_run' THEN 500
    WHEN 'ach_marathon' THEN 5000
    WHEN 'ach_landlord' THEN 10000
    ELSE reward_experience
END;
