import React, { useEffect, useRef, useState } from "react";
import type { Feature, Point } from "geojson";
import { CircleLayer, ShapeSource } from "@maplibre/maplibre-react-native";
import { useUserLocation } from "../../../context/UserLocationContext";

const SMOOTH_INTERVAL_MS = 33; // ~30 fps
const LERP_SPEED = 0.2; // Fraction of remaining gap closed per frame
const SNAP_THRESHOLD_DEG = 0.0000005; // ~0.05 m — close enough to snap

export default function UserLocationMarker() {
  const { latitude, longitude, errorMsg } = useUserLocation();

  const [displayLat, setDisplayLat] = useState<number | null>(null);
  const [displayLon, setDisplayLon] = useState<number | null>(null);

  const targetRef = useRef<{ lat: number; lon: number } | null>(null);
  const displayedRef = useRef<{ lat: number; lon: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (latitude == null || longitude == null) return;

    targetRef.current = { lat: latitude, lon: longitude };

    // First position — snap immediately, no animation
    if (!displayedRef.current) {
      displayedRef.current = { lat: latitude, lon: longitude };
      setDisplayLat(latitude);
      setDisplayLon(longitude);
      return;
    }

    // Start smoothing loop if not already running
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        const target = targetRef.current;
        const displayed = displayedRef.current;
        if (!target || !displayed) return;

        const dLat = target.lat - displayed.lat;
        const dLon = target.lon - displayed.lon;

        if (
          Math.abs(dLat) < SNAP_THRESHOLD_DEG &&
          Math.abs(dLon) < SNAP_THRESHOLD_DEG
        ) {
          // Close enough — snap to target and stop the loop
          displayed.lat = target.lat;
          displayed.lon = target.lon;
          setDisplayLat(target.lat);
          setDisplayLon(target.lon);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        displayed.lat += dLat * LERP_SPEED;
        displayed.lon += dLon * LERP_SPEED;
        setDisplayLat(displayed.lat);
        setDisplayLon(displayed.lon);
      }, SMOOTH_INTERVAL_MS);
    }
  }, [latitude, longitude]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  if (displayLat == null || displayLon == null) {
    if (errorMsg) console.log("UserLocationMarker:", errorMsg);
    return null;
  }

  const shape: Feature<Point> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [displayLon, displayLat],
    },
  };

  return (
    <ShapeSource id="user-marker" shape={shape}>
      <CircleLayer
        id="user-marker-circle"
        style={{
          circleRadius: 7,
          circleColor: "#2563EB",
          circleOpacity: 1,
          circleStrokeWidth: 5,
          circleStrokeColor: "rgba(0,0,0,0.18)",
        }}
      />
    </ShapeSource>
  );
}
