import React, { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";
import { ShapeSource, CircleLayer, SymbolLayer } from "@maplibre/maplibre-react-native";

export function ClassZonesLayer() {
  const [zoneData, setZoneData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // From: src/components/map/layers/ClassZonesLayer.tsx
        // To:   geojson_files/class_zones/class_zones.geojson
        const asset = Asset.fromModule(
          require("../../../../geojson_files/class_zones/class_zones.geojson")
        );

        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        if (!parsed || parsed.type !== "FeatureCollection") {
          throw new Error("class_zones.geojson is not a valid FeatureCollection");
        }

        if (!cancelled) setZoneData(parsed as FeatureCollection);
      } catch (e) {
        console.error("Failed to load class zones GeoJSON:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!zoneData) return null;

  return (
    <ShapeSource id="class-zones-source" shape={zoneData}>
      <CircleLayer
        id="class-zones-circle"
        style={{
          circleRadius: 6,
          circleColor: "#2E86AB",
          circleStrokeWidth: 1,
          circleStrokeColor: "#ffffff",
        }}
      />
      <SymbolLayer
        id="class-zones-label"
        style={{
          textField: ["get", "label"],
          textSize: 12,
          textOffset: [0, 1.2],
          textAnchor: "top",
        }}
      />
    </ShapeSource>
  );
}
