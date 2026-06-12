export async function preloadMapTiles(centerLat: number, centerLng: number, radiusKm: number = 2) {
  // A simple util to pre-fetch AMap tiles around the user's location
  // So the Service Worker caches them for offline use
  console.log(`[TilePreloader] Starting preload around ${centerLat}, ${centerLng} (radius: ${radiusKm}km)`);
  
  // Simple heuristic for zoom levels
  const zooms = [14, 15, 16];
  
  const tileUrls: string[] = [];
  
  const deg2num = (lat: number, lon: number, zoom: number) => {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    const xtile = Math.floor((lon + 180) / 360 * n);
    const ytile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: xtile, y: ytile };
  };

  zooms.forEach(z => {
    // Approx tile range based on radius
    const centerTile = deg2num(centerLat, centerLng, z);
    const offset = z === 14 ? 1 : z === 15 ? 2 : 4; // Roughly scales with zoom
    
    for (let x = centerTile.x - offset; x <= centerTile.x + offset; x++) {
      for (let y = centerTile.y - offset; y <= centerTile.y + offset; y++) {
        // AMap standard tile URL format
        tileUrls.push(`https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`);
      }
    }
  });

  console.log(`[TilePreloader] Fetching ${tileUrls.length} tiles...`);
  
  // Fetch in batches to avoid network congestion
  const batchSize = 10;
  for (let i = 0; i < tileUrls.length; i += batchSize) {
    const batch = tileUrls.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(url => fetch(url, { mode: 'no-cors' })));
  }
  
  console.log(`[TilePreloader] Preload complete.`);
}
