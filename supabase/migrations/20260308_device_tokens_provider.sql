-- ============================================================
-- 为 device_tokens 表添加 provider 字段
-- 支持多推送厂商（FCM / JPush / APNs）
-- ============================================================

-- 添加 provider 列，默认值 'fcm' 兼容已有数据
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS provider text
    CHECK (provider IN ('fcm', 'jpush', 'apns'))
    DEFAULT 'fcm';

-- 添加注释说明
COMMENT ON COLUMN public.device_tokens.provider IS
  '推送服务提供商: fcm (Firebase), jpush (极光), apns (Apple 直连)';
