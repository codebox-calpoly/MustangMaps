import React from "react";
import type { FeatureCollection } from "geojson";
import {
  ShapeSource,
  FillLayer,
  LineLayer,
} from "@maplibre/maplibre-react-native";

interface ClassZonesLayerProps {
  zoneData: FeatureCollection | null;
  selectedZoneLabel?: string | null;
}

export function ClassZonesLayer({
  zoneData,
  selectedZoneLabel = null,
}: ClassZonesLayerProps) {
  if (!zoneData || !selectedZoneLabel) {
    return null;
  }

  return (
    <ShapeSource id="class-zones-source" shape={zoneData}>
      <FillLayer
        id="class-zones-fill"
        filter={["==", ["get", "label"], selectedZoneLabel]}
        style={{
          fillColor: "#FCD34D",
          fillOpacity: 0.45,
        }}
      />
      <LineLayer
        id="class-zones-line"
        filter={["==", ["get", "label"], selectedZoneLabel]}
        style={{
          lineColor: "#F59E0B",
          lineWidth: 3,
        }}
      />
    </ShapeSource>
  );
}