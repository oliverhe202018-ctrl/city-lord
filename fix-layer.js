const fs = require('fs');

let c = fs.readFileSync('components/map/TerritoryLayer.tsx', 'utf-8');

c = c.replace(/const stringToColor[\s\S]*?^};$/m,
    `import { generateTerritoryStyle } from "@/lib/citylord/territory-renderer";
import { ViewContext } from "@/types/city";`);

c = c.replace(/const style = getTerritoryStyle\(territory, viewMode\);[\s\S]*?zIndex: 50, \/\/ Ensure territories are above the base map\r?\n\s*extData: territory \/\/ Store territory data for click handler\r?\n\s*}\);/m,
    `          const ctx: ViewContext = {
            userId: city.userId || null, 
            subject: viewMode === 'faction' ? 'faction' : 'individual'
          };
          const style = generateTerritoryStyle(territory as any, ctx);

          const polygon = new (window as any).AMap.Polygon({
            path: path,
            fillColor: style.fillColor2D,
            fillOpacity: 0.5,
            strokeColor: style.strokeColor2D,
            strokeWeight: 2,
            zIndex: 50,
            extData: territory
          });`);

fs.writeFileSync('components/map/TerritoryLayer.tsx', c);
console.log('done');
