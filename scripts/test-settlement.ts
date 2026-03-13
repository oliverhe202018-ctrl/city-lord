import { processTerritorySettlement } from '../lib/territory/settlement';
import * as turf from '@turf/turf';

async function main() {
    console.log('Testing territory settlement...');
    const pathGeoJSON = turf.polygon([[
        [116.397, 39.908],
        [116.398, 39.908],
        [116.398, 39.909],
        [116.397, 39.909],
        [116.397, 39.908]
    ]]);
    
    // Convert degrees to meters for turf area roughly? turf area uses WGS84 so degrees are fine.
    console.log('Area:', turf.area(pathGeoJSON));

    const result = await processTerritorySettlement({
        runId: 'test_run_123',
        userId: 'f002d0fd-2780-4be6-b250-9a9da8ab5b61', // Use a valid UUID format just in case
        pathGeoJSON
    });
    console.log('Result:', result);
}

main().catch(console.error);
