-- 确保 pgcrypto 扩展已启用
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  target_email text := 'oliverhe202018@gmail.com';
  target_password text := 'aaa021300';
  user_id uuid;
BEGIN
  -- 1. 检查用户是否存在
  SELECT id INTO user_id FROM auth.users WHERE email = target_email;

  IF user_id IS NOT NULL THEN
    -- 用户已存在，更新密码
    UPDATE auth.users
    SET encrypted_password = crypt(target_password, gen_salt('bf')),
        updated_at = now(),
        email_confirmed_at = COALESCE(email_confirmed_at, now()), -- 确保邮箱已验证
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb -- 确保 provider 设置正确
    WHERE id = user_id;
    
    RAISE NOTICE 'User % already exists. Password updated.', target_email;
  ELSE
    -- 用户不存在，创建新用户
    user_id := gen_random_uuid();
    
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
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      target_email,
      crypt(target_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now()
    );
    
    RAISE NOTICE 'User % created successfully.', target_email;
  END IF;

  -- 2. 确保 profile 存在
  -- 如果 profile 不存在则插入，如果存在则保持原样
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
    user_id,
    split_part(target_email, '@', 1),
    1,
    0,
    1000,
    100,
    100,
    0
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Profile ensured for user %', target_email;
END $$;
