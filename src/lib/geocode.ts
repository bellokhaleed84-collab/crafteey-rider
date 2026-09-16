export interface LatLng {
  lat: number;
  lng: number;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Thin wrapper around Mapbox's Geocoding API — reuses the same public
// token already used for the map itself, so no separate geocoding key is
// needed. Converts a free-text address into coordinates. Returns null on
// any failure (bad address, network issue, no token) so callers can fall
// back gracefully instead of throwing.
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!address?.trim() || !MAPBOX_TOKEN) return null;
  try {
    const encoded = encodeURIComponent(address.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.center || feature.center.length < 2) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  fullAddress: string;
  coords: LatLng;
}

// Not wired into any screen yet — kept here for when a manual "search a
// place" input is actually needed (e.g. an address-correction flow).
// Returns up to 5 ranked suggestions instead of a single best match.
export async function searchAddresses(query: string): Promise<PlaceSuggestion[]> {
  if (!query?.trim() || !MAPBOX_TOKEN) return [];
  try {
    const encoded = encodeURIComponent(query.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=5&country=ng`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const features = data?.features ?? [];
    return features
      .filter((f: any) => Array.isArray(f.center) && f.center.length >= 2)
      .map((f: any) => ({
        id: f.id,
        name: f.text,
        fullAddress: f.place_name,
        coords: { lat: f.center[1], lng: f.center[0] },
      }));
  } catch {
    return [];
  }
}