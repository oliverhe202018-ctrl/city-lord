import json

with open('tsconfig.json', 'r', encoding='utf-8') as f:
    content = f.read()

# using simple string replacement
if '"exclude": [' in content:
    new_content = content.replace('"exclude": [', '"exclude": [\n    "city-lord-app",')
    with open('tsconfig.json', 'w', encoding='utf-8') as f:
        f.write(new_content)
