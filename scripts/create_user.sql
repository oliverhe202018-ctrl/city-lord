-- 确保 pgcrypto 扩展已启用（用于密码加密）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  user_email text := 'oliverhe202018@gmail.com';
  user_password text := 'aaa021300';
BEGIN
  -- 1. 插入到 auth.users 表
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 2. 插入到 public.profiles 表
  -- 如果你有自动创建 profile 的触发器，这一步可能会自动完成
  -- 使用 ON CONFLICT DO NOTHING 避免重复插入报错
  INSERT INTO public.profiles (
    id,
    nickname,
    level,
    current_exp,
    max_exp,
    stamina,
    max_stamina,
    total_area
  ) VALUES (
    new_user_id,
    split_part(user_email, '@', 1), -- 默认使用邮箱前缀作为昵称
    1,
    0,
    1000,
    100,
    100,
    0
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'User created successfully: %', user_email;
END $$;
