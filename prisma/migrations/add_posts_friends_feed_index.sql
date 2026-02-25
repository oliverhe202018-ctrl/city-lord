-- 偏函数索引：覆盖 FRIENDS 模式 feed 查询
-- WHERE status = 'ACTIVE' AND user_id IN (...) ORDER BY created_at DESC
-- 仅索引 ACTIVE 帖子，体积更小、命中率更高
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_friends_feed"
ON "posts" ("user_id", "created_at" DESC)
WHERE "status" = 'ACTIVE';
