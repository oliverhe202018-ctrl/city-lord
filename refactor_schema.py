import re

with open(r'd:\project\city-lord\prisma\schema.prisma', 'r', encoding='utf-8') as f:
    schema = f.read()

# Delete the redundant storeItem model (lines 185-195 approx)
schema = re.sub(r'model storeItem \{[^}]+\}\n', '', schema)

# Refactor table names
table_replacements = {
    r'model UserWallet\b': 'model user_wallets',
    r'model WalletTransaction\b': 'model wallet_transactions',
    r'model DailyStat\b': 'model daily_stats',
    r'model ProvinceStat\b': 'model province_stats',
    r'model FactionStatsCache\b': 'model faction_stats_caches',
    r'model rewardLog\b': 'model reward_logs',
    r'model expLog\b': 'model exp_logs',
    # relations replacements
    r'wallet\s+UserWallet\?': 'user_wallet user_wallets?',
    r'wallet\s+UserWallet': 'user_wallet user_wallets',
    r'UserWallet\b': 'user_wallets',
    r'DailyStat\b': 'daily_stats',
    r'ProvinceStat\b': 'province_stats',
    r'FactionStatsCache\b': 'faction_stats_caches',
    r'rewardLog\b': 'reward_logs',
    r'expLog\b': 'exp_logs',
}

for pattern, repl in table_replacements.items():
    schema = re.sub(pattern, repl, schema)

# General mapping to snake_case for field names in the models we want to fix
replacements = [
    ('isProfilePublic', 'is_profile_public'),
    ('backgroundUrl', 'background_url'),
    ('blockedMe', 'blocked_me'),
    ('blockedByMe', 'blocked_by_me'),
    ('profileLikesGiven', 'profile_likes_given'),
    ('profileLikesReceived', 'profile_likes_received'),
    ('userBackgrounds', 'user_backgrounds'),
    ('watchActivities', 'watch_activities'),
    ('redCount', 'red_count'),
    ('blueCount', 'blue_count'),
    ('totalTerritories', 'total_territories'),
    ('createdAt', 'created_at'),
    ('provinceName', 'province_name'),
    ('totalTerritoryArea', 'total_territory_area'),
    ('eventsLog', 'events_log'),
    ('antiCheatLog', 'anti_cheat_log'),
    ('isValid', 'is_valid'),
    ('totalSteps', 'total_steps'),
    ('aiSummary', 'ai_summary'),
    ('userId', 'user_id'),
    ('likerId', 'liker_id'),
    ('blockerId', 'blocker_id'),
    ('blockedId', 'blocked_id'),
    ('previewUrl', 'preview_url'),
    ('imageUrl', 'image_url'),
    ('isDefault', 'is_default'),
    ('conditionType', 'condition_type'),
    ('conditionValue', 'condition_value'),
    ('priceCoins', 'price_coins'),
    ('backgroundId', 'background_id'),
    ('acquiredAt', 'acquired_at'),
    ('referenceId', 'reference_id'),
    ('oldExp', 'old_exp'),
    ('newExp', 'new_exp')
]

for camel, snake in replacements:
    # Use negative lookbehind so we don't accidentally match Prisma attributes like @createdAt (if any)
    schema = re.sub(r'(?<!@)\b' + camel + r'\b', snake, schema)

# Clean up leftover @map/@@map correctly
# First, remove `@@map("...")` entirely
schema = re.sub(r'^[ \t]*@@map\("[^"]+"\)[ \t]*\n', '', schema, flags=re.MULTILINE)
# Second, remove `@map("...")` entirely from lines
schema = re.sub(r'[ \t]*@map\("[^"]+"\)', '', schema)

with open(r'd:\project\city-lord\scratch_schema.prisma', 'w', encoding='utf-8') as f:
    f.write(schema)
print('Done!')
