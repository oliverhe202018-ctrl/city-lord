const fs = require('fs');

let c = fs.readFileSync('components/map/GaodeMap3D.tsx', 'utf-8');

// Add imports at the top
c = c.replace(/import \{ Location \} from "@\/hooks\/useRunningTracker"/,
    `import { Location } from "@/hooks/useRunningTracker"
import { generateTerritoryStyle, generateNeutralTerritoryStyle } from "@/lib/citylord/territory-renderer"
import { ViewContext } from "@/types/city"`);

// Add currentUserId state near user colors
c = c.replace(/const \[fillColor, setFillColor\] = useState\('#3B82F6'\)/,
    `const [fillColor, setFillColor] = useState('#3B82F6')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)`);

c = c.replace(/if \(data\.fill_color\) setFillColor\(data\.fill_color\)/,
    `if (data.fill_color) setFillColor(data.fill_color)
          setCurrentUserId(user.id)`);

// Ensure currentUserId is in dependency array of the Effect
c = c.replace(/}, \[isMapReady, safeHexagons, exploredHexes, safeTerritories\]\)/,
    `}, [isMapReady, safeHexagons, exploredHexes, safeTerritories, currentUserId])`);

// Replace the data merge and render logic
const targetRegex = /\/\/ Convert Real Data[\s\S]*?addLog\("Layer Style Set & Rendered"\)/m;

const replacement = `    // Convert Real Data
    const realGeoJSON = h3ToAmapGeoJSON(safeHexagons)

    // Build Territory Map for O(1) matching
    const territoryMap = new Map();
    safeTerritories.forEach(t => territoryMap.set(t.id, t));

    const ctx: ViewContext = {
      userId: currentUserId,
      subject: 'individual' // default to individual for immersive mode unless specified
    };

    // Enrich with Health Data and Precompute Styles
    if (safeHexagons.length > 0) {
      realGeoJSON.features.forEach((feature: any) => {
        const t = territoryMap.get(feature.properties.h3Index);
        if (t) {
          feature.properties._styleCache = generateTerritoryStyle(t as any, ctx);
          feature.properties.health = t.health ?? 1000;
          feature.properties.maxHealth = t.maxHealth ?? 1000;
          feature.properties.ownerType = t.ownerType;
        } else {
          feature.properties._styleCache = generateNeutralTerritoryStyle(ctx);
          feature.properties.health = 1000;
          feature.properties.maxHealth = 1000;
          feature.properties.ownerType = 'neutral';
        }
      })
    }

    // Merge Debug Data if list is empty
    let finalFeatures = realGeoJSON.features
    if (finalFeatures.length === 0) {
      addLog("No hexagons provided, adding DEBUG feature")
      // Quick dummy context
      debugFeature.properties.health = 1000;
      (debugFeature.properties as any)._styleCache = generateNeutralTerritoryStyle(ctx);
      finalFeatures = [debugFeature as any]
    }

    const source = new window.Loca.GeoJSONSource({
      data: {
        type: 'FeatureCollection',
        features: finalFeatures
      }
    })

    const layer = prismLayerRef.current
    layer.setSource(source)

    layer.setStyle({
      unit: 'meter',
      sideColor: (index: number, feature: any) => {
        const props = feature.properties
        if (props.h3Index === 'DEBUG_HEX') return 'rgba(255, 0, 0, 0.5)'
        return props._styleCache?.sideColor || 'rgba(100, 100, 100, 0.3)'
      },
      topColor: (index: number, feature: any) => {
        const props = feature.properties
        if (props.h3Index === 'DEBUG_HEX') return '#ff0000'
        return props._styleCache?.topColor || '#3f3f46'
      },
      height: (index: number, feature: any) => {
        const baseHeight = feature.properties.height || 100
        const scale = feature.properties._styleCache?.heightScale ?? 1.0;
        return baseHeight * scale
      },
      altitude: 0
    })

    // Click Interaction
    // Note: Loca 2.0 requires manual picking often.
    mapInstanceRef.current.on('click', (e: any) => {
      const feat = layer.queryFeature(e.pixel)
      if (feat) {
        const props = feat.properties
        const health = props.health ?? 1000
        const maxHealth = props.maxHealth ?? 1000
        
        let status = "Healthy"
        if (props._styleCache?.isCritical) status = "Critical (Lost in <4 days)"
        else if (props._styleCache?.isDamaged) status = "Damaged"

        toast(\`Hex \${props.h3Index.substring(0, 6)}...\`, {
          description: \`Health: \${health}/\${maxHealth} (\${status})\`
        })
      }
    })

    addLog("Layer Style Set & Rendered")`;

c = c.replace(targetRegex, replacement);

fs.writeFileSync('components/map/GaodeMap3D.tsx', c);
console.log('done');
