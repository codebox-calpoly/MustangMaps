import React from "react";
import type { FeatureCollection } from "geojson";
import {
  ShapeSource,
  FillLayer,
  LineLayer,
} from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

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
  const { mapStyle } = useMapContext();
  const dark = mapStyle === "dark";

  if (!zoneData) {
    return null;
  }

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
          fillColor: dark ? "#FDE047" : "#FCD34D",
          fillOpacity: dark ? 0.7 : 0.45,
        }}
      />
      <LineLayer
        id="class-zones-line"
        filter={zoneFilter}
        style={{
          lineColor: dark ? "#FBBF24" : "#F59E0B",
          lineWidth: dark ? 3.5 : 3,
        }}
      />
    </ShapeSource>
  );
}