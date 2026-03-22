import React from "react";
import type { FeatureCollection } from "geojson";
import {
  ShapeSource,
  FillLayer,
  LineLayer,
} from "@maplibre/maplibre-react-native";

interface ClassZonesLayerProps {
  zoneData: FeatureCollection | null;
  selectedZoneId?: string | null;
  selectedZoneBuildingId?: string | null;
}

export function ClassZonesLayer({
  zoneData,
  selectedZoneId = null,
  selectedZoneBuildingId = null,
}: ClassZonesLayerProps) {
  if (!zoneData) {
    return null;
  }

  // Always keep the ShapeSource mounted so the GeoJSON data stays loaded.
  // When no zone is selected, use an impossible filter to hide everything.
  const zoneFilter =
    selectedZoneId && selectedZoneBuildingId
      ? ([
          "all",
          ["==", ["get", "zone_id"], selectedZoneId],
          ["==", ["get", "building_id"], selectedZoneBuildingId],
        ] as const)
      : (["==", ["get", "zone_id"], "__none__"] as const);

  return (
    <ShapeSource id="class-zones-source" shape={zoneData}>
      <FillLayer
        id="class-zones-fill"
        filter={zoneFilter}
        style={{
          fillColor: "#FCD34D",
          fillOpacity: 0.45,
        }}
      />
      <LineLayer
        id="class-zones-line"
        filter={zoneFilter}
        style={{
          lineColor: "#F59E0B",
          lineWidth: 3,
        }}
      />
    </ShapeSource>
  );
}