import os
import re

directories = ['app', 'lib', 'utils']

replacements = {
    # Model invocations
    'prisma.userWallet': 'prisma.user_wallets',
    'prisma.walletTransaction': 'prisma.wallet_transactions',
    'prisma.dailyStat': 'prisma.daily_stats',
    'prisma.provinceStat': 'prisma.province_stats',
    'prisma.factionStatsCache': 'prisma.faction_stats_caches',
    'prisma.rewardLog': 'prisma.reward_logs',
    'prisma.expLog': 'prisma.exp_logs',
    
    # Fields mapping based on the actual sql changes:
    # We only want to replace fields if they match as whole words
}

word_replacements = {
    'blockedMe': 'blocked_me',
    'blockedByMe': 'blocked_by_me',
    'profileLikesGiven': 'profile_likes_given',
    'profileLikesReceived': 'profile_likes_received',
    'userBackgrounds': 'user_backgrounds',
    'watchActivities': 'watch_activities',
    'redCount': 'red_count',
    'blueCount': 'blue_count',
    'totalTerritories': 'total_territories',
    'createdAt': 'created_at',
    'totalTerritoryArea': 'total_territory_area',
    'provinceName': 'province_name',
    'referenceId': 'reference_id',
    'oldExp': 'old_exp',
    'newExp': 'new_exp'
}

# Add the word replacements to generic replacements but carefully using regex word boundaries
def process_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original_content = content

    for old, new in replacements.items():
        content = content.replace(old, new)

    for old, new in word_replacements.items():
        # Match old word only if it is a whole word
        # e.g. .createdAt, { createdAt: ... }, createdAt=
        content = re.sub(r'\b' + old + r'\b', new, content)

    if content != original_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

for d in directories:
    root_dir = os.path.join(r'd:\project\city-lord', d)
    if not os.path.exists(root_dir): continue
    for root, _, files in os.walk(root_dir):
        for name in files:
            if name.endswith('.ts') or name.endswith('.tsx'):
                process_file(os.path.join(root, name))
