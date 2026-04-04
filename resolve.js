const fs = require('fs');

function resolveGaodeMap() {
    let file = fs.readFileSync('components/map/GaodeMap3D.tsx', 'utf8');

    // 1
    file = file.replace(/<<<<<<< HEAD(\r?\n)\s*const \{ territoryAppearance \} = useGameTerritoryAppearance\(\)(\r?\n)=======(\r?\n)([\s\S]*?)>>>>>>> [^\r\n]+(\r?\n)/g, 
      '  const { territoryAppearance } = useGameTerritoryAppearance()$1$4');

    // 2
    file = file.replace(/<<<<<<< HEAD(\r?\n)=======(\r?\n)(\s*\/\/ Explicitly destroy the map instance[\s\S]*?)>>>>>>> [^\r\n]+(\r?\n)/g, 
      '$3');

    // 3
    file = file.replace(/<<<<<<< HEAD(\r?\n)(\s*console\.warn\('Failed to clean up map overlays:', e\);)(\r?\n)=======(\r?\n)[\s\S]*?>>>>>>> [^\r\n]+(\r?\n)>>>>>>> [^\r\n]+(\r?\n)/g, 
      '$2$3');

    fs.writeFileSync('components/map/GaodeMap3D.tsx', file);
    console.log("GaodeMap3D.tsx resolved.");
}

resolveGaodeMap();
