import React from "react";
import { ShapeSource, FillLayer, LineLayer } from "@maplibre/maplibre-react-native";
import type { FeatureCollection } from "geojson";

type AddGeoJSONLayerArgs = {
  id: string; // base id for source + layers
  data: FeatureCollection;

  fillColor?: string;
  fillOpacity?: number;

  outlineColor?: string;
  outlineWidth?: number;
};

export function addGeoJSONLayer({
  id,
  data,
  fillColor = "#6B7280",
  fillOpacity = 0.25,
  outlineColor = "#111827",
  outlineWidth = 1,
}: AddGeoJSONLayerArgs) {
  return (
    <ShapeSource id={`${id}-source`} shape={data}>
      <FillLayer
        id={`${id}-fill`}
        style={{
          fillColor,
          fillOpacity,
        }}
      />
      <LineLayer
        id={`${id}-outline`}
        style={{
          lineColor: outlineColor,
          lineWidth: outlineWidth,
        }}
      />
    </ShapeSource>
  );
}
