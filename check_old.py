import re

with open('old_schema.prisma', 'r', encoding='utf-16') as f:
    lines = f.readlines()

models = {}
current_model = None

for line in lines:
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
        map_match = re.search(r'@@map\(\"([A-Za-z0-9_]+)\"\)', line)
        if map_match:
            models[current_model]['db_name'] = map_match.group(1)
            continue
            
        parts = line.split()
        if len(parts) >= 2 and not line.startswith('@@'):
            field_name = parts[0]
            db_field_name = field_name
            f_map_match = re.search(r'@map\(\"([A-Za-z0-9_]+)\"\)', line)
            if f_map_match:
                db_field_name = f_map_match.group(1)
            
            models[current_model]['fields'][field_name] = db_field_name

print('Found models:', len(models))
for model, v in models.items():
    if model != v['db_name']:
        print(f'Model {model} -> {v["db_name"]}')
    for f, df in v['fields'].items():
        if f != df:
            print(f'{model}.{f} -> {df}')
