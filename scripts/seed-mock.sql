INSERT INTO territories (
    id, city_id, owner_id, current_hp, max_hp, territory_type, score_weight, status, geojson_json
) VALUES (
    'mock-polygon-001', '110000', (SELECT id FROM profiles LIMIT 1), 1000, 1000, 'NORMAL', 1.0, 'ACTIVE', 
    '{"type":"Polygon","coordinates":[[[116.390, 39.900], [116.400, 39.900], [116.400, 39.910], [116.390, 39.910], [116.390, 39.900]]]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
