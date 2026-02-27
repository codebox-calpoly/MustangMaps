import React, { useMemo } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { CircleLayer, LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

export function RouteLineLayer() {
  const { activePath, routeStart, routeEnd } = useMapContext();

  const lineCollection = useMemo<FeatureCollection<LineString> | null>(() => {
    if (!activePath || activePath.path.length < 2) {
      return null;
    }
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: activePath.path,
          },
          properties: {},
        },
      ],
    };
  }, [activePath]);

  const pointCollection = useMemo<FeatureCollection<Point> | null>(() => {
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
  }, [routeStart, routeEnd]);

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
                "#2563EB",
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
