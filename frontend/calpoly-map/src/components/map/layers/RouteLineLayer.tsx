import React, { useMemo } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { CircleLayer, LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

type Coord = [number, number];

/**
 * Project `point` onto segment A→B and return the interpolated coordinate
 * plus the parametric position `t` (0 = at A, 1 = at B).
 * Uses flat-Earth approximation (accurate at campus scale).
 */
function projectOntoSegment(
  point: Coord,
  segA: Coord,
  segB: Coord,
): { projected: Coord; t: number } {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((segA[1] + segB[1]) / 2) * toRad);

  // Flat-meter offsets relative to segA
  const px = (point[0] - segA[0]) * cosLat * 111_320;
  const py = (point[1] - segA[1]) * 111_320;
  const bx = (segB[0] - segA[0]) * cosLat * 111_320;
  const by = (segB[1] - segA[1]) * 111_320;

  const lenSq = bx * bx + by * by;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;

  const projected: Coord = [
    segA[0] + t * (segB[0] - segA[0]),
    segA[1] + t * (segB[1] - segA[1]),
  ];
  return { projected, t };
}

/**
 * Squared flat-Earth distance (meters²) — cheaper than sqrt for comparisons.
 */
function flatDistSq(a: Coord, b: Coord): number {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((a[1] + b[1]) / 2) * toRad);
  const dx = (b[0] - a[0]) * cosLat * 111_320;
  const dy = (b[1] - a[1]) * 111_320;
  return dx * dx + dy * dy;
}

export function RouteLineLayer() {
  const {
    activePath,
    routeStart,
    routeEnd,
    navigationMode,
    userLocation,
  } = useMapContext();

  const lineCollection = useMemo<FeatureCollection<LineString> | null>(() => {
    if (!activePath || activePath.path.length < 2) {
      return null;
    }

    let coordinates = activePath.path;

    // During navigation, continuously trim the walked portion of the path
    if (navigationMode && userLocation) {
      const path = activePath.path;

      // Find the path segment closest to the user's current location
      let bestSegIdx = 0;
      let bestDistSq = Number.POSITIVE_INFINITY;
      let bestProjected: Coord = path[0];

      for (let i = 0; i < path.length - 1; i++) {
        const { projected } = projectOntoSegment(userLocation as Coord, path[i], path[i + 1]);
        const dSq = flatDistSq(userLocation as Coord, projected);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestSegIdx = i;
          bestProjected = projected;
        }
      }

      // Build the remaining path: projected point → rest of the path after that segment
      const remaining: Coord[] = [bestProjected];

      // Only add the segment endpoint if the projection isn't already at the end
      const segEnd = path[bestSegIdx + 1];
      if (bestProjected[0] !== segEnd[0] || bestProjected[1] !== segEnd[1]) {
        remaining.push(segEnd);
      }

      // Append all points after the segment
      for (let i = bestSegIdx + 2; i < path.length; i++) {
        remaining.push(path[i]);
      }

      // Prepend user's location for a seamless line from the blue dot
      if (remaining.length > 0) {
        coordinates = [userLocation as Coord, ...remaining];
      } else {
        coordinates = [userLocation as Coord];
      }
    }

    if (coordinates.length < 2) {
      return null;
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates,
          },
          properties: {},
        },
      ],
    };
  }, [activePath, navigationMode, userLocation]);

  // Hide start/end dots during navigation (user location marker is sufficient)
  const pointCollection = useMemo<FeatureCollection<Point> | null>(() => {
    if (navigationMode) {
      return null;
    }
    if (!routeStart && !routeEnd) {
      return null;
    }
    const features: Feature<Point>[] = [];
    if (routeStart) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: routeStart },
        properties: { kind: "start" },
      });
    }
    if (routeEnd) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: routeEnd },
        properties: { kind: "end" },
      });
    }
    return { type: "FeatureCollection", features };
  }, [navigationMode, routeStart, routeEnd]);

  return (
    <>
      {lineCollection && (
        <ShapeSource id="route-line-source" shape={lineCollection}>
          <LineLayer
            id="route-line"
            style={{
              lineColor: "#2563EB",
              lineWidth: 4,
              lineOpacity: 0.9,
            }}
          />
        </ShapeSource>
      )}
      {pointCollection && (
        <ShapeSource id="route-points-source" shape={pointCollection}>
          <CircleLayer
            id="route-points"
            style={{
              circleColor: [
                "match",
                ["get", "kind"],
                "start",
                "#10B981",
                "end",
                "#EF4444",
                "#6B7280",
              ],
              circleRadius: 6,
              circleStrokeWidth: 2,
              circleStrokeColor: "#FFFFFF",
            }}
          />
        </ShapeSource>
      )}
    </>
  );
}
