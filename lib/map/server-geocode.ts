type AmapRegeoAddressComponent = {
  city?: string | string[];
  province?: string;
  district?: string;
  adcode?: string;
};

type AmapRegeoResponse = {
  status?: string;
  regeocode?: {
    addressComponent?: AmapRegeoAddressComponent;
  };
};

/**
 * 城市名降级策略（批示 1）：
 * 1. 优先使用 city（普通地级市）
 * 2. 直辖市 city 为空时，降级到 district（如"朝阳区"）
 * 3. district 也为空时，降级到 province（如"北京市"）
 * 4. 全部为空时，兜底为 "未知区域-" + adcode
 */
function resolveCityName(address: AmapRegeoAddressComponent): string | null {
  const city = address.city;
  const cityName = Array.isArray(city) ? (city.length > 0 ? city[0] : null) : (city || null);
  if (cityName) return cityName;

  if (address.district) return address.district;
  if (address.province) return address.province;
  if (address.adcode) return `未知区域-${address.adcode}`;

  return null;
}

export async function reverseGeocodeCity(
  lat: number,
  lng: number
): Promise<{ cityName: string | null; adcode: string | null }> {
  const key = process.env.AMAP_SERVER_KEY || process.env.NEXT_PUBLIC_AMAP_KEY;
  if (!key) return { cityName: null, adcode: null };

  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${key}&location=${lng},${lat}&extensions=base&output=json`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { cityName: null, adcode: null };

    const data: AmapRegeoResponse = await res.json();
    const address = data.regeocode?.addressComponent;
    if (data.status !== '1' || !address) {
      return { cityName: null, adcode: null };
    }

    const cityName = resolveCityName(address);

    return {
      cityName,
      adcode: address.adcode ?? null,
    };
  } catch {
    return { cityName: null, adcode: null };
  }
}
