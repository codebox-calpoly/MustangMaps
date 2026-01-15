import React from "react";
import {
  ShapeSource,
  FillLayer,
  LineLayer,
  type OnPressEvent,
} from "@maplibre/maplibre-react-native";

const buildings = require("../../../geojson_files/buildings.geojson");

export type SelectedBuilding = {
  coordinate: [number, number]; // [lng,lat]
  properties: Record<string, any>;
};

export function BuildingLayer({
  onSelectBuilding,
}: {
  onSelectBuilding: (b: SelectedBuilding) => void;
}) {
  const onBuildingPress = (e: OnPressEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;

    const lng = e.coordinates?.longitude;
    const lat = e.coordinates?.latitude;
    if (typeof lng !== "number" || typeof lat !== "number") return;

    onSelectBuilding({
      coordinate: [lng, lat],
      properties: feature.properties ?? {},
    });
  };

  return (
    <ShapeSource id="buildings-source" shape={buildings} onPress={onBuildingPress}>
      <FillLayer
        id="buildings-fill"
        style={{ fillColor: "#2563EB", fillOpacity: 0.18 }}
      />
      <LineLayer
        id="buildings-outline"
        style={{ lineColor: "#1F2937", lineWidth: 1 }}
      />
    </ShapeSource>
  );
}
