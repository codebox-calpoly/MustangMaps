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
    routeEnd,
    navigationMode,
    userLocation,
  } = useMapContext();

  const lineCollection = useMemo<FeatureCollection<LineString> | null>(() => {
    if (!activePath || !activePath.path || activePath.path.length < 2) {
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

      // Only prepend user location if they're close to the path.
      // A long straight connector line from GPS to the path cuts through
      // buildings and looks like a fake route.
      const MAX_CONNECTOR_DIST_SQ = 5 * 5; // 5 m
      if (remaining.length > 0 && bestDistSq <= MAX_CONNECTOR_DIST_SQ) {
        coordinates = [userLocation as Coord, ...remaining];
      } else if (remaining.length > 0) {
        coordinates = remaining;
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

  // Destination marker: placed at the last point of the active path so it
  // sits exactly where the route line terminates, not at the raw building center.
  const destinationMarker = useMemo<FeatureCollection<Point> | null>(() => {
    if (navigationMode) return null;
    const end =
      activePath?.path?.length
        ? activePath.path[activePath.path.length - 1]
        : routeEnd;
    if (!end) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: end },
          properties: {},
        },
      ],
    };
  }, [navigationMode, activePath, routeEnd]);

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
      {destinationMarker && (
        <ShapeSource id="route-destination-source" shape={destinationMarker}>
          {/* Outer red ring */}
          <CircleLayer
            id="route-destination-outer"
            style={{
              circleColor: "#EF4444",
              circleRadius: 11,
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          {/* Inner white dot */}
          <CircleLayer
            id="route-destination-inner"
            style={{
              circleColor: "#FFFFFF",
              circleRadius: 4,
            }}
          />
        </ShapeSource>
      )}
    </>
  );
}
