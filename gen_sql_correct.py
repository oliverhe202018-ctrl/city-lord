import re

def parse_schema(path):
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
            models[current_model] = {'db_name': current_model, 'fields': {}}
            continue
        
        if current_model and line == '}':
            current_model = None
            continue
            
        if current_model:
            map_match = re.search(r'@@map\(\s*\"([A-Za-z0-9_]+)\"\s*\)', line)
            if map_match:
                models[current_model]['db_name'] = map_match.group(1)
                continue
                
            parts = line.split()
            if len(parts) >= 2 and not line.startswith('@@'):
                field_name = parts[0]
                db_field_name = field_name
                f_map_match = re.search(r'@map\(\s*\"([A-Za-z0-9_]+)\"\s*\)', line)
                if f_map_match:
                    db_field_name = f_map_match.group(1)
                
                models[current_model]['fields'][field_name] = db_field_name
    return models

def parse_schema_old(path):
    with open(path, 'r', encoding='utf-16', errors='ignore') as f:
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
            models[current_model] = {'db_name': current_model, 'fields': {}}
            continue
        
        if current_model and line == '}':
            current_model = None
            continue
            
        if current_model:
            map_match = re.search(r'@@map\(\s*\"([A-Za-z0-9_]+)\"\s*\)', line)
            if map_match:
                models[current_model]['db_name'] = map_match.group(1)
                continue
                
            parts = line.split()
            if len(parts) >= 2 and not line.startswith('@@'):
                field_name = parts[0]
                db_field_name = field_name
                f_map_match = re.search(r'@map\(\s*\"([A-Za-z0-9_]+)\"\s*\)', line)
                if f_map_match:
                    db_field_name = f_map_match.group(1)
                
                models[current_model]['fields'][field_name] = db_field_name
    return models

old_models = parse_schema_old('old_schema.prisma')
new_models = parse_schema('prisma/schema.prisma')

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

for old_m, old_data in old_models.items():
    if old_m == 'storeItem':
        continue

    expected_new = to_snake_plural(old_m)
    if expected_new not in new_models and old_m in new_models:
        expected_new = old_m
    
    new_m = expected_new

    if new_m not in new_models:
        continue

    new_data = new_models[new_m]
    
    old_db_table = old_data['db_name']
    new_db_table = new_data['db_name']

    current_table_name = old_db_table

    if old_db_table != new_db_table:
        sql.append(f'ALTER TABLE "{old_db_table}" RENAME TO "{new_db_table}";')
        current_table_name = new_db_table

    def field_to_snake(name):
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

    for of, old_db_col in old_data['fields'].items():
        expected_nf = field_to_snake(of)
        
        if expected_nf in new_data['fields']:
            new_db_col = new_data['fields'][expected_nf]
            if old_db_col != new_db_col:
                sql.append(f'ALTER TABLE "{current_table_name}" RENAME COLUMN "{old_db_col}" TO "{new_db_col}";')

sql.append('COMMIT;')
print('\n'.join(sql))
