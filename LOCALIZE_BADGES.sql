-- -----------------------------------------------------------------------------
-- Badge Localization Migration Script
-- Target Table: badges
-- -----------------------------------------------------------------------------

-- 1. Localize Categories (分类汉化)
UPDATE badges SET category = '探索' WHERE category = 'Exploration';
UPDATE badges SET category = '社交' WHERE category = 'Social';
UPDATE badges SET category = '收藏' WHERE category = 'Collection';
UPDATE badges SET category = '对战' WHERE category = 'Combat';

-- Optional: Categories found in codebase but not in user request (Uncomment if needed)
-- UPDATE badges SET category = '耐力' WHERE category = 'Endurance';
-- UPDATE badges SET category = '征服' WHERE category = 'Conquest';
-- UPDATE badges SET category = '速度' WHERE category = 'Speed';
-- UPDATE badges SET category = '特殊' WHERE category = 'Special';


-- 2. Localize Badge Names & Descriptions (勋章内容汉化)
-- City Explorer
UPDATE badges 
SET name = '城市探索者', 
    description = '累计探索 10 个不同的地块'
WHERE name = 'City Explorer';

-- City Walker
UPDATE badges 
SET name = '城市漫步者', 
    description = '累计行走里程达到 50 公里'
WHERE name = 'City Walker';

-- Early Bird
UPDATE badges 
SET name = '早起的鸟儿', 
    description = '在清晨 5:00 - 7:00 期间进行跑步'
WHERE name = 'Early Bird';

-- Night Walker
UPDATE badges 
SET name = '夜行者', 
    description = '在夜间 22:00 - 02:00 期间进行跑步'
WHERE name = 'Night Walker';


-- 3. Localize Tiers (等级汉化)
-- Case-insensitive matching to cover both 'Bronze' and 'bronze'
UPDATE badges SET tier = '青铜' WHERE LOWER(tier) = 'bronze';
UPDATE badges SET tier = '白银' WHERE LOWER(tier) = 'silver';
UPDATE badges SET tier = '黄金' WHERE LOWER(tier) = 'gold';
UPDATE badges SET tier = '白金' WHERE LOWER(tier) = 'platinum';
UPDATE badges SET tier = '钻石' WHERE LOWER(tier) = 'diamond';
