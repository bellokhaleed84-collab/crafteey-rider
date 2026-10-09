"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { RouteGeometry } from "@/lib/directions";
import GoogleMapsFab from "@/components/map/GoogleMapsFab";
import type { GoogleTravelMode } from "@/lib/navigation";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export interface LatLng {
  lat: number;
  lng: number;
}

type Pt = [number, number];

// Dark map in dark mode, normal street map in light mode. The map swaps
// by itself when the rider changes Appearance in Settings.
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
const LIGHT_STYLE = "mapbox://styles/mapbox/streets-v12";
const ORANGE = "#FF7A1A";
const ROUTE_SRC = "rider-route";
const ARROW_IMAGE = "route-arrow";
const FOLLOW_ZOOM = 16.5;
const FOLLOW_PITCH = 60;
const PREVIEW_ZOOM = 15.5;
const PREVIEW_PITCH = 45;

function isDarkTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

interface RouteMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  courierLocation?: LatLng | null;
  route?: RouteGeometry | null;
  className?: string;
  onError?: () => void;
  showControls?: boolean;
  // true = full 3D chase camera that follows the rider and turns with the
  // road (used on the active delivery screen). false = calm preview that
  // just centres on the rider.
  followCourier?: boolean;
  // Distance of the "Follow me" button from the bottom of the map.
  recenterBottom?: number;
  // The stop to put the pulsing ring and heading on. Defaults to
  // dropoff, then pickup.
  nextStop?: LatLng | null;
  // Where the round Google Maps button goes. undefined = automatic (the
  // current stop while chasing, nothing otherwise). null = no button.
  googleMapsTo?: LatLng | null;
  googleTravelMode?: GoogleTravelMode;
  // Bump this number to make the chase camera snap back onto the rider.
  recenterSignal?: number;
}

function distM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

// The big navigation arrow that sits on the rider. Same shape as the orange
// arrow button. It points the way the rider is heading.
function buildRiderArrowEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:72px;height:72px;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.55));";
  el.innerHTML =
    '<svg viewBox="0 0 72 72" width="72" height="72" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="36" cy="36" r="34" fill="rgba(255,122,26,0.22)"/>' +
    '<g transform="translate(7.2 8.4) scale(2.4)">' +
    '<path d="M12 2L4.5 20.29a.5.5 0 00.72.63L12 17l6.78 3.92a.5.5 0 00.72-.63L12 2z" ' +
    'fill="#FF7A1A" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>' +
    "</g>" +
    "</svg>";
  return el;
}

function buildRingEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "width:44px;height:44px;position:relative;pointer-events:none;";
  el.innerHTML = '<span class="rm-ring"></span><span class="rm-ring" style="animation-delay:.9s"></span>';
  return el;
}

function setLine(map: mapboxgl.Map, coords: Pt[]) {
  try {
    const src = map.getSource(ROUTE_SRC) as mapboxgl.GeoJSONSource | undefined;
    src?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords.length > 1 ? coords : [] },
    } as any);
  } catch {
    // style not ready yet
  }
}

// A small white chevron pointing right. Mapbox turns it to follow the
// direction of the line, so it points the way the rider should travel.
function ensureArrowImage(map: mapboxgl.Map) {
  try {
    if (map.hasImage(ARROW_IMAGE)) return;
    const size = 28;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 6);
    ctx.lineTo(19, 14);
    ctx.lineTo(9, 22);
    ctx.stroke();
    map.addImage(ARROW_IMAGE, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
  } catch {
    // arrows are a visual extra, never break the map
  }
}

// Runs on every style load, because a new style wipes custom layers.
function ensureLayers(map: mapboxgl.Map, dark: boolean) {
  ensureArrowImage(map);
  try {
    if (!map.getLayer("3d-buildings") && map.getSource("composite")) {
      const layers = map.getStyle().layers ?? [];
      const labelLayer = layers.find((l) => l.type === "symbol" && (l.layout as any)?.["text-field"]);
      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": dark ? "#232a3a" : "#d9d5cc",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": dark ? 0.85 : 0.7,
          },
        } as any,
        labelLayer?.id
      );
    }
  } catch {
    // buildings are a visual extra, never break the map
  }
  try {
    if (!map.getSource(ROUTE_SRC)) {
      map.addSource(ROUTE_SRC, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      } as any);
      map.addLayer({
        id: "rider-route-glow",
        type: "line",
        source: ROUTE_SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ORANGE, "line-width": 14, "line-opacity": 0.25, "line-blur": 6 },
      } as any);
      map.addLayer({
        id: "rider-route-line",
        type: "line",
        source: ROUTE_SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ORANGE, "line-width": 6, "line-opacity": 1 },
      } as any);
      map.addLayer({
        id: "rider-route-arrows",
        type: "symbol",
        source: ROUTE_SRC,
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 56,
          "icon-image": ARROW_IMAGE,
          "icon-size": 1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotation-alignment": "map",
          "icon-pitch-alignment": "map",
        },
      } as any);
    }
  } catch {
    // route line is a visual extra, never break the map
  }
}

interface Anim {
  pos: LatLng | null;
  from: LatLng;
  to: LatLng;
  start: number;
  dur: number;
  // Where the big arrow points (turns quickly).
  heading: number;
  targetHeading: number;
  // Where the camera is turned to (follows the road more slowly, so the
  // arrow visibly swings left or right in a turn).
  camBearing: number;
  lastUpdateAt: number;
  raf: number;
  lastLineAt: number;
  camReadyAt: number;
}

export default function RouteMap({
  pickup,
  dropoff,
  courierLocation,
  route,
  className,
  onError,
  showControls = true,
  followCourier = false,
  recenterBottom,
  nextStop,
  googleMapsTo,
  googleTravelMode,
  recenterSignal,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const courierMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const ringMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const loadedRef = useRef(false);
  const erroredRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const followCourierRef = useRef(followCourier);
  followCourierRef.current = followCourier;
  // "Plain me view": no stops, no route, not chasing - just show the rider.
  const plainMeRef = useRef(false);
  plainMeRef.current = !followCourier && !pickup && !dropoff && !route;

  // The stop the rider is heading to.
  const target = nextStop ?? dropoff ?? pickup ?? null;
  const targetRef = useRef<LatLng | null>(target);
  targetRef.current = target;
  const tLat = target?.lat;
  const tLng = target?.lng;

  // Where the round Google Maps button goes.
  const gmDest = googleMapsTo !== undefined ? googleMapsTo : followCourier ? target : null;

  const followRef = useRef(true);
  const hasCourierRef = useRef(false);
  const [showRecenter, setShowRecenter] = useState(false);

  const routeCoordsRef = useRef<Pt[] | null>(null);
  const routeIdxRef = useRef(0);

  const animRef = useRef<Anim>({
    pos: null,
    from: { lat: 0, lng: 0 },
    to: { lat: 0, lng: 0 },
    start: 0,
    dur: 1,
    heading: 0,
    targetHeading: 0,
    camBearing: 0,
    lastUpdateAt: 0,
    raf: 0,
    lastLineAt: 0,
    camReadyAt: 0,
  });

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const chase = followCourierRef.current;
    let styleDark = isDarkTheme();
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleDark ? DARK_STYLE : LIGHT_STYLE,
      center: [3.3792, 6.5244], // Lagos fallback
      zoom: 11,
      antialias: true,
      dragRotate: chase,
      pitchWithRotate: chase,
      touchPitch: chase,
      attributionControl: false,
    });

    if (!chase) map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    if (showControls) {
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
        "bottom-right"
      );
    }

    // Switch the map style when the rider changes light/dark in Settings.
    const themeObserver = new MutationObserver(() => {
      const dark = isDarkTheme();
      if (dark === styleDark) return;
      styleDark = dark;
      try {
        map.setStyle(dark ? DARK_STYLE : LIGHT_STYLE);
      } catch {
        // map is mid-teardown
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Keep the map sized right when its box changes (for example when a
    // request sheet slides in underneath it).
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          // map already gone
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    // Any manual gesture pauses following until the rider taps "Follow me".
    const pause = (e: any) => {
      if (e?.originalEvent && hasCourierRef.current && followRef.current) {
        followRef.current = false;
        if (followCourierRef.current) setShowRecenter(true);
      }
    };
    map.on("dragstart", pause);
    map.on("rotatestart", pause);
    map.on("pitchstart", pause);
    map.on("zoomstart", pause);

    loadedRef.current = false;
    map.once("load", () => {
      loadedRef.current = true;
    });
    map.on("style.load", () => {
      ensureLayers(map, styleDark);
      refreshLine();
    });

    map.on("error", (e) => {
      console.error("Mapbox error:", e?.error);
      if (!erroredRef.current) {
        erroredRef.current = true;
        onErrorRef.current?.();
      }
    });

    mapRef.current = map;

    return () => {
      const current = mapRef.current;
      themeObserver.disconnect();
      resizeObserver?.disconnect();
      cancelAnimationFrame(animRef.current.raf);
      animRef.current.raf = 0;
      animRef.current.pos = null;
      hasCourierRef.current = false;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      courierMarkerRef.current = null;
      ringMarkerRef.current = null;
      routeCoordsRef.current = null;

      if (!current) return;
      const safeRemove = () => {
        try {
          current.remove();
        } catch {
          // Already torn down or mid-teardown from a prior cycle.
        }
      };
      if (loadedRef.current) {
        safeRemove();
      } else {
        current.once("load", safeRemove);
        current.once("error", safeRemove);
      }
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls]);

  // New stop (pickup -> drop-off): drop the old route and re-follow the rider.
  // Declared before the route effect so a fresh route arriving in the same
  // render still wins.
  useEffect(() => {
    routeCoordsRef.current = null;
    routeIdxRef.current = 0;
    refreshLine();
    if (followCourierRef.current && animRef.current.pos) recenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tLat, tLng]);

  // "Start navigation" asks the chase camera to snap back onto the rider.
  useEffect(() => {
    if (!recenterSignal) return;
    if (followCourierRef.current) recenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  // Route line
  useEffect(() => {
    const raw = route && route.coordinates && route.coordinates.length > 1 ? route.coordinates : null;
    const coords = raw ? (raw as unknown as Pt[]) : null;
    routeCoordsRef.current = coords;
    routeIdxRef.current = 0;
    refreshLine();

    const map = mapRef.current;
    if (map && coords && !followCourierRef.current) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Pickup marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (!pickup) {
      pickupMarkerRef.current?.remove();
      pickupMarkerRef.current = null;
      return;
    }
    if (!pickupMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow";
      pickupMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(mapRef.current);
    } else {
      pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
    }
    if (!route) fitToMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng]);

  // Dropoff marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (!dropoff) {
      dropoffMarkerRef.current?.remove();
      dropoffMarkerRef.current = null;
      return;
    }
    if (!dropoffMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "h-4 w-4 rounded-full border-2 border-white bg-brand-accent shadow";
      dropoffMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(mapRef.current);
    } else {
      dropoffMarkerRef.current.setLngLat([dropoff.lng, dropoff.lat]);
    }
    if (!route) fitToMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropoff?.lat, dropoff?.lng]);

  // Pulsing ring on the stop the rider is heading to
  const hasCourier = !!courierLocation;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasCourier || tLat == null || tLng == null) {
      ringMarkerRef.current?.remove();
      ringMarkerRef.current = null;
      return;
    }
    if (!ringMarkerRef.current) {
      ringMarkerRef.current = new mapboxgl.Marker({
        element: buildRingEl(),
        pitchAlignment: "map",
        rotationAlignment: "map",
      })
        .setLngLat([tLng, tLat])
        .addTo(map);
    } else {
      ringMarkerRef.current.setLngLat([tLng, tLat]);
    }
  }, [hasCourier, tLat, tLng]);

  // The rider's own live position: smooth movement, heading, camera follow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const a = animRef.current;

    if (!courierLocation) {
      if (courierMarkerRef.current) stopCourier(map);
      return;
    }

    const now = performance.now();
    if (!a.pos) {
      a.pos = courierLocation;
      a.from = courierLocation;
      a.to = courierLocation;
      a.start = now;
      a.dur = 1;
      a.heading = targetRef.current ? bearingDeg(courierLocation, targetRef.current) : 0;
      a.targetHeading = a.heading;
      a.camBearing = a.heading;
      a.lastUpdateAt = now;
      a.camReadyAt = now + 1400;
      hasCourierRef.current = true;
      followRef.current = true;
      setShowRecenter(false);

      // "viewport" pitch keeps the big arrow standing up and readable even
      // when the 3D camera is tilted. "map" rotation turns it with the road.
      courierMarkerRef.current = new mapboxgl.Marker({
        element: buildRiderArrowEl(),
        pitchAlignment: "viewport",
        rotationAlignment: "map",
      })
        .setLngLat([courierLocation.lng, courierLocation.lat])
        .setRotation(a.heading)
        .addTo(map);

      if (followCourierRef.current) {
        map.easeTo({
          center: [courierLocation.lng, courierLocation.lat],
          zoom: FOLLOW_ZOOM,
          pitch: FOLLOW_PITCH,
          bearing: a.camBearing,
          duration: 1200,
        });
      } else if (plainMeRef.current) {
        map.easeTo({
          center: [courierLocation.lng, courierLocation.lat],
          zoom: PREVIEW_ZOOM,
          pitch: PREVIEW_PITCH,
          duration: 1000,
        });
      }
      a.raf = requestAnimationFrame(tick);
    } else {
      if (distM(a.to, courierLocation) < 1) return;
      a.from = a.pos;
      a.to = courierLocation;
      const gap = now - a.lastUpdateAt;
      a.dur = Math.min(8000, Math.max(1500, gap));
      a.start = now;
      a.lastUpdateAt = now;
      if (distM(a.from, a.to) > 3) a.targetHeading = bearingDeg(a.from, a.to);
      if (!a.raf) a.raf = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courierLocation?.lat, courierLocation?.lng]);

  // Draws the route line. While chasing, it starts at the rider's current
  // position and only shows what is left of the trip.
  function refreshLine() {
    const map = mapRef.current;
    if (!map) return;
    const a = animRef.current;
    const coords = routeCoordsRef.current;

    if (a.pos && followCourierRef.current) {
      const pos = a.pos;
      if (coords && coords.length > 1) {
        let i = routeIdxRef.current;
        const d = (p: Pt) => distM(pos, { lng: p[0], lat: p[1] });
        while (i < coords.length - 1 && d(coords[i + 1]) <= d(coords[i])) i++;
        routeIdxRef.current = i;
        setLine(map, [[pos.lng, pos.lat], ...coords.slice(i + 1)]);
      } else if (targetRef.current) {
        const tgt = targetRef.current;
        setLine(map, [
          [pos.lng, pos.lat],
          [tgt.lng, tgt.lat],
        ]);
      } else {
        setLine(map, []);
      }
      return;
    }

    setLine(map, coords && coords.length > 1 ? coords : []);
  }

  function tick() {
    const a = animRef.current;
    const map = mapRef.current;
    const marker = courierMarkerRef.current;
    if (!a.pos || !map || !marker) {
      a.raf = 0;
      return;
    }
    const now = performance.now();
    const t = Math.min(1, (now - a.start) / a.dur);
    const pos: LatLng = {
      lat: a.from.lat + (a.to.lat - a.from.lat) * t,
      lng: a.from.lng + (a.to.lng - a.from.lng) * t,
    };
    a.pos = pos;
    // The arrow turns fast; the camera turns slowly. The gap between them is
    // what makes the arrow visibly swing left or right in a turn.
    a.heading = (a.heading + angleDiff(a.heading, a.targetHeading) * 0.12 + 360) % 360;
    a.camBearing = (a.camBearing + angleDiff(a.camBearing, a.heading) * 0.03 + 360) % 360;

    marker.setLngLat([pos.lng, pos.lat]);
    marker.setRotation(a.heading);

    if (followRef.current && now > a.camReadyAt) {
      if (followCourierRef.current) {
        map.jumpTo({ center: [pos.lng, pos.lat], bearing: a.camBearing });
      } else if (plainMeRef.current) {
        map.jumpTo({ center: [pos.lng, pos.lat] });
      }
    }
    if (followCourierRef.current && now - a.lastLineAt > 100) {
      a.lastLineAt = now;
      refreshLine();
    }
    a.raf = requestAnimationFrame(tick);
  }

  function stopCourier(map: mapboxgl.Map) {
    const a = animRef.current;
    cancelAnimationFrame(a.raf);
    a.raf = 0;
    a.pos = null;
    hasCourierRef.current = false;
    courierMarkerRef.current?.remove();
    courierMarkerRef.current = null;
    ringMarkerRef.current?.remove();
    ringMarkerRef.current = null;
    followRef.current = true;
    setShowRecenter(false);
    refreshLine();
    if (followCourierRef.current) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      fitToMarkers();
    }
  }

  function recenter() {
    const map = mapRef.current;
    const a = animRef.current;
    if (!map || !a.pos) return;
    followRef.current = true;
    setShowRecenter(false);
    a.camReadyAt = performance.now() + 900;
    a.camBearing = a.heading;
    map.easeTo({
      center: [a.pos.lng, a.pos.lat],
      zoom: FOLLOW_ZOOM,
      pitch: FOLLOW_PITCH,
      bearing: a.camBearing,
      duration: 800,
    });
  }

  function fitToMarkers() {
    if (!mapRef.current) return;
    // While the rider is being chased, the camera belongs to the tracker.
    if (hasCourierRef.current && followCourierRef.current) return;
    const points: [number, number][] = [];
    if (pickup) points.push([pickup.lng, pickup.lat]);
    if (dropoff) points.push([dropoff.lng, dropoff.lat]);
    if (points.length === 0) return;
    if (points.length === 1) {
      mapRef.current.flyTo({ center: points[0], zoom: 14 });
      return;
    }
    const bounds = points.reduce(
      (b, p) => b.extend(p),
      new mapboxgl.LngLatBounds(points[0], points[0])
    );
    mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  }

  return (
    <div className={`crafteey-map-shell relative overflow-hidden ${className ?? "h-64 w-full rounded-2xl"}`}>
      <div ref={containerRef} className="h-full w-full" />
      {gmDest && (
        <GoogleMapsFab lat={gmDest.lat} lng={gmDest.lng} travelMode={googleTravelMode} />
      )}
      {showRecenter && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Follow me"
          className="absolute left-3 z-10 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg"
          style={{ backgroundColor: ORANGE, bottom: recenterBottom ?? (followCourier ? 152 : 12) }}
        >
          Follow me
        </button>
      )}
      {/* Shrinks Mapbox's required attribution control down to something
          unobtrusive on small map boxes. It can be made small but not
          removed - Mapbox's terms require it to stay visible. */}
      <style jsx global>{`
        .crafteey-map-shell .mapboxgl-ctrl-attrib {
          font-size: 8px !important;
          line-height: 1.2 !important;
          padding: 0 4px !important;
          background: rgba(255, 255, 255, 0.5) !important;
        }
        .crafteey-map-shell .mapboxgl-ctrl-attrib a {
          font-size: 8px !important;
        }
        .crafteey-map-shell .mapboxgl-ctrl-attrib.mapboxgl-compact {
          min-height: 16px;
        }
        .crafteey-map-shell .mapboxgl-ctrl-bottom-left {
          transform: scale(0.85);
          transform-origin: bottom left;
        }
        .rm-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid #ff7a1a;
          opacity: 0;
          animation: rm-ring 1.8s ease-out infinite;
        }
        @keyframes rm-ring {
          0% {
            transform: scale(0.3);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}