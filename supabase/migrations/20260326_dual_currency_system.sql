-- Create Dual Currency System Tables

-- 1. Create UserWallet table
CREATE TABLE IF NOT EXISTS public."UserWallet" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sweat_coins INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create WalletTransaction table
CREATE TABLE IF NOT EXISTS public."WalletTransaction" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    currency_type VARCHAR(20) DEFAULT 'COIN' NOT NULL,
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create storeItem table
CREATE TABLE IF NOT EXISTS public."storeItem" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    inventory_count INTEGER DEFAULT -1 NOT NULL, -- -1 for unlimited
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Initial Migration: Sync coins from profiles to UserWallet
INSERT INTO public."UserWallet" (user_id, sweat_coins)
SELECT id, COALESCE(coins, 0) FROM public.profiles
ON CONFLICT (user_id) DO UPDATE SET sweat_coins = EXCLUDED.sweat_coins;

-- 5. Initial Migration: Sync items from store_items to storeItem
INSERT INTO public."storeItem" (id, name, description, price, inventory_count, is_active, created_at)
SELECT id, name, description, price, inventory_count, true, created_at FROM public.store_items
ON CONFLICT (id) DO NOTHING;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_user ON public."WalletTransaction"(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON public."UserWallet"(user_id);

-- 7. Enable RLS (Optional, usually handled by Supabase but good to define)
ALTER TABLE public."UserWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."storeItem" ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Example: Users can only see their own wallet)
DROP POLICY IF EXISTS "Users can view their own wallet" ON public."UserWallet";
CREATE POLICY "Users can view their own wallet" ON public."UserWallet"
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own transactions" ON public."WalletTransaction";
CREATE POLICY "Users can view their own transactions" ON public."WalletTransaction"
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view active store items" ON public."storeItem";
CREATE POLICY "Anyone can view active store items" ON public."storeItem"
    FOR SELECT USING (is_active = true);
