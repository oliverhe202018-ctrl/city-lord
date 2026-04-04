const fs = require('fs');

function patchMapHeader() {
    let content = fs.readFileSync('components/map/MapHeader.tsx', 'utf8');

    // 1. Add import
    if (!content.includes('useLocationStore')) {
        content = content.replace(
            /import \{ useLocationContext \} from "\@\/components\/GlobalLocationProvider".*/,
            'import { useLocationContext } from "@/components/GlobalLocationProvider"\nimport { useLocationStore } from "@/store/useLocationStore"'
        );
    }

    // 2. Add gpsSignalStrength
    if (!content.includes('const gpsSignalStrength = useLocationStore')) {
        content = content.replace(
            /const setKingdomMode = interactionContext\?\.setKingdomMode;.*/,
            'const setKingdomMode = interactionContext?.setKingdomMode;\n  const gpsSignalStrength = useLocationStore((s) => s.gpsSignalStrength);'
        );
    }

    // 3. Fix getGpsStatusConfig
    const oldStatusLogic = `
    // 只要有坐标，就视为定位成功 (As long as we have coordinates, show success)
    const hasLocation = (latitude !== null && longitude !== null && latitude !== 0 && longitude !== 0) ||
      (lastKnownLocation && lastKnownLocation.lat !== 0 && lastKnownLocation.lng !== 0) ||
      (gpsStatus === 'success'); // Allow gpsStatus to override if needed

    if (hasLocation) {
      return { icon: Signal, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/20', border: 'border-[#22c55e]/50', text: '已定位' }
    }

    switch (gpsStatus) {
      case 'locating': return { icon: Navigation, color: 'text-slate-900 dark:text-white', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: '定位中' }
      case 'error': return { icon: Navigation, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'GPS异常' }
      default: return { icon: Navigation, color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: '无信号' }
    }`.trim().replace(/\r\n/g, '\n');

    const newStatusLogic = `
    const hasCachedOrRealLocation = (latitude !== null && longitude !== null && latitude !== 0 && longitude !== 0) ||
      (lastKnownLocation && lastKnownLocation.lat !== 0 && lastKnownLocation.lng !== 0);

    if (gpsStatus === 'success' && gpsSignalStrength !== 'none' && hasCachedOrRealLocation) {
      return { icon: Signal, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/20', border: 'border-[#22c55e]/50', text: '已定位' }
    }

    switch (gpsStatus) {
      case 'locating': return { icon: Navigation, color: 'text-slate-900 dark:text-white', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: '定位中' }
      case 'error': return { icon: Navigation, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'GPS异常' }
      default: return { icon: Navigation, color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: '无信号' }
    }`.trim().replace(/\r\n/g, '\n');

    let normalizedContent = content.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(oldStatusLogic)) {
        content = normalizedContent.replace(oldStatusLogic, newStatusLogic);
        fs.writeFileSync('components/map/MapHeader.tsx', content);
        console.log('MapHeader.tsx updated successfully');
    } else {
        console.log('Could not find old status logic in MapHeader.tsx');
    }
}

function patchGlobalLocationProvider() {
    let content = fs.readFileSync('components/GlobalLocationProvider.tsx', 'utf8');

    const oldLogic = `
        const bridge = new AMapLocationBridge({
            onLocationUpdate: (point: GeoPoint, meta?: LocationMeta) => {
                if (!mountedRef.current) return;

                const rawSource = (point.source ?? 'amap-native') as string;`.trim().replace(/\r\n/g, '\n');

    const newLogic = `
        const bridge = new AMapLocationBridge({
            onLocationUpdate: (point: GeoPoint, meta?: LocationMeta) => {
                if (!mountedRef.current) return;

                // [NEW] 核心熔断器：如果坐标精度超过 100米，强制丢弃，防止地图蓝点和全局状态漂移
                if (point.accuracy != null && point.accuracy > 100) {
                    console.warn(\`\${TAG} Dropped location due to low accuracy: \${point.accuracy}m > 100m\`);
                    // 虽然丢弃坐标，但更新信号状态为 weak 或 none
                    useLocationStore.setState({
                        gpsSignalStrength: 'none',
                    });
                    return;
                }

                const rawSource = (point.source ?? 'amap-native') as string;`.trim().replace(/\r\n/g, '\n');

    let normalizedContent = content.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(oldLogic)) {
        content = normalizedContent.replace(oldLogic, newLogic);
        fs.writeFileSync('components/GlobalLocationProvider.tsx', content);
        console.log('GlobalLocationProvider.tsx updated successfully');
    } else {
        console.log('Could not find old logic in GlobalLocationProvider.tsx');
    }
}

function patchStartRunPageClient() {
    let content = fs.readFileSync('components/citylord/start/StartRunPageClient.tsx', 'utf8');
    
    // Using Regex to reliably replace the hardcoded "6:00" string
    const oldHtml = '<p className="text-2xl font-black leading-none">6:00</p>';
    const newHtml = '<p className="text-2xl font-black leading-none">--\'--"</p>';
    
    if (content.includes(oldHtml)) {
        content = content.replace(oldHtml, newHtml);
        fs.writeFileSync('components/citylord/start/StartRunPageClient.tsx', content);
        console.log('StartRunPageClient.tsx updated successfully');
    } else {
        console.log('Could not find old HTML in StartRunPageClient.tsx');
    }
}

try {
    patchMapHeader();
    patchGlobalLocationProvider();
    patchStartRunPageClient();
} catch (e) {
    console.error(e);
}
