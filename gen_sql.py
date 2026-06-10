import re

def get_models(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    content = content.replace('\x00', '')

    models = {}
    current_model = None
    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('//'): continue
        m = re.match(r'model\s+([A-Za-z0-9_]+)\s*\{', line)
        if m:
            current_model = m.group(1)
            models[current_model] = []
        elif current_model and line == '}':
            current_model = None
        elif current_model and line:
            parts = line.split()
            if len(parts) >= 2 and not line.startswith('@@'):
                field_name = parts[0]
                models[current_model].append(field_name)
    return models

old_models = get_models('old_schema.prisma')
new_models = get_models('prisma/schema.prisma')

def to_snake_plural(name):
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    snake = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
    if snake == 'reward_log': return 'reward_logs'
    if snake == 'exp_log': return 'exp_logs'
    if snake == 'user_wallet': return 'user_wallets'
    if snake == 'wallet_transaction': return 'wallet_transactions'
    if snake == 'daily_stat': return 'daily_stats'
    if snake == 'province_stat': return 'province_stats'
    if snake == 'faction_stats_cache': return 'faction_stats_caches'
    return snake

sql = ['BEGIN;']

for old_m, old_fields in old_models.items():
    if old_m == 'storeItem':
        continue 

    expected_new = to_snake_plural(old_m)
    if expected_new not in new_models and old_m in new_models:
        expected_new = old_m
    
    new_m = expected_new

    if new_m not in new_models:
        print(f'-- Warning: Could not find new model for {old_m}')
        continue

    if old_m != new_m:
        sql.append(f'ALTER TABLE "{old_m}" RENAME TO "{new_m}";')

    new_fields = new_models[new_m]
    
    def field_to_snake(name):
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

    for of in old_fields:
        expected_nf = field_to_snake(of)
        
        if expected_nf in new_fields and expected_nf != of:
            sql.append(f'ALTER TABLE "{new_m}" RENAME COLUMN "{of}" TO "{expected_nf}";')

sql.append('COMMIT;')

with open('migration_script.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))
