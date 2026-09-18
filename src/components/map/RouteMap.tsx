"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { RouteGeometry } from "@/lib/directions";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export interface LatLng {
  lat: number;
  lng: number;
}

const ROUTE_SOURCE_ID = "rider-route";
const ROUTE_LAYER_ID = "rider-route-line";
const MARKER_ANIM_MS = 1000;

interface RouteMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  courierLocation?: LatLng | null;
  route?: RouteGeometry | null;
  className?: string;
  onError?: () => void;
  showControls?: boolean;
  // When true, the camera eases toward courierLocation on every update
  // instead of only re-fitting when the route line changes. Pauses
  // automatically if the rider manually drags/zooms the map, so it never
  // fights the user — resumes on the next route recalculation.
  followCourier?: boolean;
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
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const courierMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const loadedRef = useRef(false);
  const erroredRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  // Route data can arrive before the map style has finished loading
  // (sources can't be added until then) — stash it here and flush it
  // once the "load" event fires.
  const pendingRouteRef = useRef<RouteGeometry | null | undefined>(undefined);

  // Smooth marker animation state
  const courierCurrentRef = useRef<[number, number] | null>(null);
  const courierAnimFrameRef = useRef<number | null>(null);

  // Camera-follow state
  const followCourierRef = useRef(followCourier);
  followCourierRef.current = followCourier;
  const followPausedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [3.3792, 6.5244], // Lagos fallback
      zoom: 11,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    });

    map.touchZoomRotate.disableRotation();
    // compact:true collapses this to a small "i" icon by default — the
    // extra CSS below shrinks it further/lightens its background so it
    // stays unobtrusive on small map boxes without removing it (Mapbox's
    // free/pay-as-you-go terms require attribution to remain visible).
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    if (showControls) {
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
        "bottom-right"
      );
    }

    // If the rider manually pans/zooms while we're following them, stop
    // fighting their input — resume once the destination/route changes.
    map.on("dragstart", () => {
      followPausedRef.current = true;
    });

    loadedRef.current = false;
    map.once("load", () => {
      loadedRef.current = true;
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.85 },
      });
      if (pendingRouteRef.current !== undefined) {
        applyRoute(pendingRouteRef.current);
      }
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
      if (courierAnimFrameRef.current) cancelAnimationFrame(courierAnimFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls]);

  function applyRoute(geometry: RouteGeometry | null) {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: geometry ?? { type: "LineString", coordinates: [] },
    });
    if (geometry && geometry.coordinates.length > 1) {
      // A fresh route means a new leg of the trip — resume following.
      followPausedRef.current = false;
      const bounds = geometry.coordinates.reduce(
        (b, c) => b.extend(c as [number, number]),
        new mapboxgl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }

  // Route line
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) {
      pendingRouteRef.current = route ?? null;
      return;
    }
    applyRoute(route ?? null);
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

  // The courier's own live position — animates smoothly between GPS
  // points instead of snapping, and optionally drags the camera along.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!courierLocation) {
      courierMarkerRef.current?.remove();
      courierMarkerRef.current = null;
      courierCurrentRef.current = null;
      return;
    }

    const to: [number, number] = [courierLocation.lng, courierLocation.lat];

    if (!courierMarkerRef.current) {
      const el = document.createElement("div");
      el.className =
        "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand text-base shadow-lg";
      el.textContent = "🏍️";
      courierMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(to)
        .addTo(mapRef.current);
      courierCurrentRef.current = to;
    } else {
      const from = courierCurrentRef.current ?? to;
      if (courierAnimFrameRef.current) cancelAnimationFrame(courierAnimFrameRef.current);

      const start = performance.now();
      const marker = courierMarkerRef.current;
      const step = (now: number) => {
        const t = Math.min((now - start) / MARKER_ANIM_MS, 1);
        const lng = from[0] + (to[0] - from[0]) * t;
        const lat = from[1] + (to[1] - from[1]) * t;
        marker.setLngLat([lng, lat]);
        if (t < 1) {
          courierAnimFrameRef.current = requestAnimationFrame(step);
        } else {
          courierCurrentRef.current = to;
        }
      };
      courierAnimFrameRef.current = requestAnimationFrame(step);
    }

    if (followCourierRef.current && !followPausedRef.current) {
      mapRef.current.easeTo({ center: to, duration: MARKER_ANIM_MS });
    }
  }, [courierLocation?.lat, courierLocation?.lng]);

  function fitToMarkers() {
    if (!mapRef.current) return;
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
      {/* Shrinks Mapbox's required attribution control down to something
          unobtrusive on small map boxes. It can be made small but not
          removed — Mapbox's terms require it to stay visible. */}
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
      `}</style>
    </div>
  );
}