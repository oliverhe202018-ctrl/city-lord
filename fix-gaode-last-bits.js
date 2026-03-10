const fs = require('fs');

let c = fs.readFileSync('components/map/GaodeMap3D.tsx', 'utf-8');

// Fix prop type
c = c.replace(/territories\?: \{ id: string; health\?: number; ownerType: 'me' \| 'enemy' \| 'neutral' \}\[\]/,
    "territories?: import('@/types/city').ExtTerritory[]");

// Fix setCurrentUserId timing
const targetAuthCode = /const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\)\s+if \(user\) \{\s+const \{ data \} = await supabase\s+\.from\('profiles'\)\s+\.select\('path_color, fill_color'\)\s+\.eq\('id', user\.id\)\s+\.single\(\)\s+if \(data\) \{\s+if \(data\.path_color\) setPathColor\(data\.path_color\)\s+if \(data\.fill_color\) setFillColor\(data\.fill_color\)\s+setCurrentUserId\(user\.id\)\s+\}/m;

const replacementAuthCode = `const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        try {
          const { data } = await supabase
            .from('profiles')
            .select('path_color, fill_color')
            .eq('id', user.id)
            .single()
          if (data) {
            if (data.path_color) setPathColor(data.path_color)
            if (data.fill_color) setFillColor(data.fill_color)
          }
        } catch (e) {
          console.warn('Failed to fetch user colors', e)
        }
      }`;

c = c.replace(targetAuthCode, replacementAuthCode);

// Fix animation loop cleanup and extraction
const targetAnimCode = /const animate = \(\) => \{\s+\/\/ loca\.viewControl\.addAnimFrame\(animate\) \/\/ Deprecated in some versions, simpler way:\s+requestAnimationFrame\(animate\)\s+loca\.animate\.start\(\)\s+\}\s+animate\(\)/m;

const replacementAnimCode = `let rafId = 0;
        const animate = () => {
          rafId = requestAnimationFrame(animate)
          loca.animate.start()
        }
        animate()
        mapInstanceRef.current._amap_raf_id = rafId;`;

c = c.replace(targetAnimCode, replacementAnimCode);

// Fix animation cancel logic in try/finally
const reqAnimCancelTarget = /if \(Array\.isArray\(polygonRefs\.current\)\) \{\s+polygonRefs\.current\.forEach\(\(p: any\) => p\?\.remove\?\.\(\)\)\s+\}\s+safeDestroyMap\(mapInstanceRef\.current\);/m;

const replacementReqAnimCancelTarget = `if (Array.isArray(polygonRefs.current)) {
          polygonRefs.current.forEach((p: any) => p?.remove?.())
        }

        if (mapInstanceRef.current?._amap_raf_id) {
          cancelAnimationFrame(mapInstanceRef.current._amap_raf_id);
        }

        safeDestroyMap(mapInstanceRef.current);`;

c = c.replace(reqAnimCancelTarget, replacementReqAnimCancelTarget);

fs.writeFileSync('components/map/GaodeMap3D.tsx', c);
console.log('done');
