const PREFER_GOOGLE_MAPS_KEY = "craftey_prefer_google_maps";

export type GoogleTravelMode = "driving" | "bicycling";

export function getPreferGoogleMaps(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREFER_GOOGLE_MAPS_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPreferGoogleMaps(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFER_GOOGLE_MAPS_KEY, String(value));
  } catch {
    // storage blocked - the choice just won't be remembered
  }
}

export function getGoogleMapsDirectionsUrl(
  destLat: number,
  destLng: number,
  travelMode: GoogleTravelMode = "driving"
) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=${travelMode}`;
}