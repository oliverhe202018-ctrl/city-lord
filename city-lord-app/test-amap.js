import AMapLoader from '@amap/amap-jsapi-loader';

async function test() {
  try {
    const AMAP_KEY = 'e7c09f023c10603e1fa8877e796965e9';
    const AMAP_SECURITY_CODE = 'e827ba611fad4802c48dd900d01eb4bf';

    globalThis._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };

    console.log("Loading AMap...");
    const AMap = await AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.MoveAnimation", "AMap.CustomLayer"],
    });
    console.log("AMap loaded successfully!");
    console.log(Object.keys(AMap));
  } catch (err) {
    console.error("AMap loading error:", err);
  }
}

test();
