-- ============================================================
-- Step 1: 启用 PostGIS（Supabase 默认已启用，保险起见加 IF NOT EXISTS）
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Step 2: 创建 cities 表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cities (
  id          TEXT PRIMARY KEY,               -- 城市标识符，如 'beijing'、'shanghai'
  name        TEXT NOT NULL,                  -- 城市显示名称
  country     TEXT,
  boundary    GEOMETRY(MULTIPOLYGON, 4326),   -- PostGIS 地理边界（WGS84）
  center_lat  DOUBLE PRECISION,               -- 城市中心纬度
  center_lng  DOUBLE PRECISION,               -- 城市中心经度
  radius_km   NUMERIC DEFAULT 50,            -- 有效半径（公里），用于 500km 距离校验
  is_active   BOOLEAN DEFAULT TRUE,           -- 是否启用该城市
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Step 3: 空间索引（查询性能关键）
-- ============================================================
CREATE INDEX IF NOT EXISTS cities_boundary_gist
  ON public.cities USING GIST (boundary);

CREATE INDEX IF NOT EXISTS cities_is_active_idx
  ON public.cities (is_active);

-- ============================================================
-- Step 4: RLS 策略
-- ============================================================
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- 所有已登录用户可读（城市数据是公开的）
CREATE POLICY "Cities are publicly readable"
  ON public.cities FOR SELECT
  USING (TRUE);

-- 只有 service_role（后端任务）可以写入
CREATE POLICY "Only service role can insert cities"
  ON public.cities FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update cities"
  ON public.cities FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================
-- Step 5: 种子数据（以实际部署城市为准）
-- ============================================================
INSERT INTO public.cities (id, name, country, center_lat, center_lng, radius_km)
VALUES
  ('beijing',   '北京',   'CN',  39.9042,  116.4074, 80),
  ('shanghai',  '上海',   'CN',  31.2304,  121.4737, 60),
  ('guangzhou', '广州',   'CN',  23.1291,  113.2644, 60),
  ('shenzhen',  '深圳',   'CN',  22.5431,  114.0579, 50),
  ('chengdu',   '成都',   'CN',  30.5728,  104.0668, 60),
  ('tianjin',   '天津',   'CN',  39.0842,  117.2009, 60),
  ('chongqing', '重庆',   'CN',  29.4316,  106.9123, 70),
  ('shijiazhuang', '石家庄', 'CN', 38.0423, 114.5025, 50),
  ('taiyuan',   '太原',   'CN',  37.8703,  112.5493, 40),
  ('huhehaote', '呼和浩特', 'CN', 40.8183, 111.6708, 40),
  ('shenyang',  '沈阳',   'CN',  41.7922,  123.4246, 60),
  ('changchun', '长春',   'CN',  43.8800,  125.3228, 50),
  ('haerbin',   '哈尔滨',   'CN',  45.7569,  126.6424, 60),
  ('nanjing',   '南京',   'CN',  32.0415,  118.7674, 50),
  ('hangzhou',  '杭州',   'CN',  30.2500,  120.1610, 50),
  ('hefei',     '合肥',   'CN',  31.8611,  117.2830, 40),
  ('fuzhou',    '福州',   'CN',  26.0753,  119.3062, 40),
  ('nanchang',  '南昌',   'CN',  28.6765,  115.8900, 40),
  ('jinan',     '济南',   'CN',  36.6685,  117.0009, 50),
  ('zhengzhou', '郑州',   'CN',  34.7466,  113.6253, 50),
  ('wuhan',     '武汉',   'CN',  30.5928,  114.3055, 60),
  ('changsha',  '长沙',   'CN',  28.2282,  112.9389, 50),
  ('nanning',   '南宁',   'CN',  22.8170,  108.3665, 40),
  ('haikou',    '海口',   'CN',  20.0450,  110.3410, 30),
  ('guiyang',   '贵阳',   'CN',  26.5783,  106.7134, 40),
  ('kunming',   '昆明',   'CN',  25.0406,  102.7122, 40),
  ('lasa',      '拉萨',   'CN',  29.6450,  91.1167, 30),
  ('xian',      '西安',   'CN',  34.2727,  108.9531, 50),
  ('lanzhou',   '兰州',   'CN',  36.0565,  103.7923, 40),
  ('xining',    '西宁',   'CN',  36.6171,  101.7782, 30),
  ('yinchuan',  '银川',   'CN',  38.4682,  106.2736, 30),
  ('wulumuqi',  '乌鲁木齐', 'CN',  43.8236,  87.6168, 70)
ON CONFLICT (id) DO NOTHING;