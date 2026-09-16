import type { LatLng } from "@/hooks/useGeolocation";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export interface RouteGeometry {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteResult {
  geometry: RouteGeometry;
  distanceMeters: number;
  durationSeconds: number;
}

// Wraps Mapbox's Directions API. "driving" is the closest available
// profile — Mapbox has no motorbike/courier profile — so ETAs will run a
// bit conservative for bike couriers who can filter through traffic.
// Same public token as the map itself, no separate key needed.
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry) return null;
    return {
      geometry: route.geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null;
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Straight-line distance between two points, in meters.
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Approximate distance from a point to a route line — minimum distance to
// any vertex on the route's coordinate list. Not exact (a true point-to-
// segment projection would be tighter) but Mapbox routes are dense enough
// that this is accurate to a few meters, which is enough to decide "has
// this rider actually gone off route" vs. "GPS jitter".
export function distanceToRouteMeters(point: LatLng, coordinates: [number, number][]): number {
  let min = Infinity;
  for (const [lng, lat] of coordinates) {
    const d = distanceMeters(point, { lat, lng });
    if (d < min) min = d;
  }
  return min;
}