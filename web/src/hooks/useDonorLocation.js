import { useEffect, useMemo, useState } from 'react'
import { asPoint } from '../utils/geo'

/** Precise device coordinates, then the saved pin, then an approximate fix. */
export function useDonorLocation(profile) {
  const [live, setLive] = useState(null)
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (result) =>
        setLive({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy,
        }),
      () => setLive(null),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])
  return useMemo(() => {
    const device = asPoint(live?.lat, live?.lng),
      saved = asPoint(profile?.latitude, profile?.longitude)
    if (device && Number.isFinite(live.accuracy) && live.accuracy <= 200)
      return { ...device, source: 'live', accuracy: live.accuracy }
    if (saved) return { ...saved, source: 'profile' }
    return device
      ? { ...device, source: 'approximate', accuracy: live.accuracy }
      : null
  }, [live, profile?.latitude, profile?.longitude])
}
