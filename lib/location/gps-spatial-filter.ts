type LatLngPoint = {
  lat: number
  lng: number
  accuracy?: number
}

type SpatialFilterDecision = {
  accept: boolean
  reason: 'first-point' | 'jitter(<2m)' | 'low-accuracy-drift' | 'fly-point(>50m)' | 'valid'
  distanceMeters: number
}

const EARTH_RADIUS_METERS = 6371000

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

const distanceMetersBetween = (a: LatLngPoint, b: LatLngPoint): number => {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))
  return EARTH_RADIUS_METERS * c
}

export const shouldAcceptPointByDistance = (
  prevPoint: LatLngPoint | null,
  nextPoint: LatLngPoint & { accuracy?: number }
): SpatialFilterDecision => {
  if (!prevPoint) {
    return { accept: true, reason: 'first-point', distanceMeters: 0 }
  }

  const distanceMeters = distanceMetersBetween(prevPoint, nextPoint)
  const accuracy = nextPoint.accuracy ?? 9999

  // Accuracy gate: when GPS signal is poor (accuracy > 50m, i.e. indoor/base-station),
  // only accept the point if displacement exceeds 50% of the reported accuracy radius.
  // This prevents network/base-station position drift from causing visible map jitter.
  if (accuracy > 50 && distanceMeters < accuracy * 0.5) {
    return { accept: false, reason: 'low-accuracy-drift', distanceMeters }
  }

  if (distanceMeters < 2) {
    return { accept: false, reason: 'jitter(<2m)', distanceMeters }
  }

  if (distanceMeters > 50) {
    return { accept: false, reason: 'fly-point(>50m)', distanceMeters }
  }

  return { accept: true, reason: 'valid', distanceMeters }
}
