import React, { useMemo } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { CircleLayer, LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

export function RouteLineLayer() {
  const {
    activePath,
    routeStart,
    routeEnd,
    navigationMode,
    navSteps,
    activeStepIndex,
    userLocation,
  } = useMapContext();

  const lineCollection = useMemo<FeatureCollection<LineString> | null>(() => {
    if (!activePath || activePath.path.length < 2) {
      return null;
    }

    let coordinates = activePath.path;

    // During navigation, trim the path to only show the remaining portion
    if (navigationMode && navSteps.length > 0) {
      const clampedIndex = Math.min(activeStepIndex, navSteps.length - 1);
      const currentStep = navSteps[clampedIndex];

      // Find where the current step's `from` appears in the full path
      // so we slice from that point onward
      const fromCoord = currentStep.from;
      let startIdx = 0;
      for (let i = 0; i < activePath.path.length; i++) {
        const pt = activePath.path[i];
        if (pt[0] === fromCoord[0] && pt[1] === fromCoord[1]) {
          startIdx = i;
          break;
        }
      }

      // Prepend user's current location for a seamless line from the blue dot
      const remaining = activePath.path.slice(startIdx);
      if (userLocation && remaining.length > 0) {
        coordinates = [userLocation, ...remaining];
      } else {
        coordinates = remaining;
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
  }, [activePath, navigationMode, navSteps, activeStepIndex, userLocation]);

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
