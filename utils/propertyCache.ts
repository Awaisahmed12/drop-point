// Reverse-geocode results keyed by rounded coordinates. Module-level so
// repeated pins on the same spot don't re-hit the Geocoding API.
type CachedAddress = { address: string; snappedLatLng: { lat: number; lng: number } | null };

const addressCache = new Map<string, CachedAddress>();

const keyFor = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export function getAddressFromCache(lat: number, lng: number): CachedAddress | null {
  return addressCache.get(keyFor(lat, lng)) || null;
}

export function saveAddressToCache(
  lat: number,
  lng: number,
  address: string,
  snappedLatLng: { lat: number; lng: number } | null,
): void {
  addressCache.set(keyFor(lat, lng), { address, snappedLatLng });
}
