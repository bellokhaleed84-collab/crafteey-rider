const PREFER_GOOGLE_MAPS_KEY = "craftey_prefer_google_maps";

export function getPreferGoogleMaps(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREFER_GOOGLE_MAPS_KEY) === "true";
}

export function setPreferGoogleMaps(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFER_GOOGLE_MAPS_KEY, String(value));
}

export function getGoogleMapsDirectionsUrl(destLat: number, destLng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
}