import React from "react";
import type { Feature, Point } from "geojson";
import { CircleLayer, ShapeSource } from "@maplibre/maplibre-react-native";
import { useUserLocation } from "../../../context/UserLocationContext";

export default function UserLocationMarker() {
  const { latitude, longitude, errorMsg } = useUserLocation();

  if (latitude == null || longitude == null) {
    console.log("UserLocationMarker:", errorMsg);
    return null;
  }

  const shape: Feature<Point> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude],
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