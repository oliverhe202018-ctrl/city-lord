const fs = require('fs');
let code = fs.readFileSync('src/hooks/useRunningTracker.ts', 'utf8');

// Add import
if (!code.includes('import { useGpsDebugStore }')) {
  code = code.replace("import { shouldAcceptPointByDistance } from '@/lib/location/gps-spatial-filter';", "import { shouldAcceptPointByDistance } from '@/lib/location/gps-spatial-filter';\nimport { useGpsDebugStore } from '@/store/useGpsDebugStore';");
}

// Inside handleLocationUpdate, find "const isAwaitingAnchor = pathRef.current.length === 0;"
if (!code.includes('const logDebugPoint')) {
  code = code.replace(
    "const isAwaitingAnchor = pathRef.current.length === 0;",
    `const isAwaitingAnchor = pathRef.current.length === 0;

    const logDebugPoint = (status: 'valid' | 'discarded', reason?: string) => {
      useGpsDebugStore.getState().addDebugPoint({
        lat,
        lng,
        status,
        reason,
        timestamp: now
      });
    };`
  );
}

// Replace returns with logDebugPoint
code = code.replace(
  /console\.debug\([^)]*Anchor REJECT[^)]*\);\s*return;/g,
  (match) => `${match.replace('return;', "logDebugPoint('discarded', 'Anchor: Low Accuracy');\n        return;")}`
);

code = code.replace(
  /console\.debug\([^)]*Layer 1 REJECT[^)]*\);\s*if \(gpsWeakTimerRef/g,
  (match) => `logDebugPoint('discarded', 'Layer 1: Accuracy > Threshold');\n        ${match}`
);

code = code.replace(
  /console\.debug\(\s*`\[GPS-Filter\] ❌ Layer 2 REJECT: speed[^)]*\)\s*;\s*return;/g,
  (match) => `${match.replace('return;', "logDebugPoint('discarded', 'Layer 2: Speed Anomaly');\n          return;")}`
);

code = code.replace(
  /console\.debug\(\s*`\[GPS-Filter\] ❌ Accel REJECT:[^)]*\)\s*;\s*return;/g,
  (match) => `${match.replace('return;', "logDebugPoint('discarded', 'Layer 2: Accel Anomaly');\n            return;")}`
);

code = code.replace(
  /console\.debug\('\[GPS Filter\] Dropped point:', spatialFilterResult\.reason\);/g,
  "console.debug('[GPS Filter] Dropped point:', spatialFilterResult.reason);\n      logDebugPoint('discarded', spatialFilterResult.reason);"
);

code = code.replace(
  /console\.debug\('\[GPS Filter\] Dropped point due to 3m debounce'\);/g,
  "console.debug('[GPS Filter] Dropped point due to 3m debounce');\n      logDebugPoint('discarded', 'Spatial Debounce (<3m)');"
);

// Add the valid log before processing the point
code = code.replace(
  "// Add point to trajectory",
  "logDebugPoint('valid', 'Accepted');\n\n    // Add point to trajectory"
);

fs.writeFileSync('src/hooks/useRunningTracker.ts', code);
console.log('Patched useRunningTracker.ts');
