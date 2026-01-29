import React, { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";
import { LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";

export function RoutesLayer() {
  const [pathData, setPathData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../../../../geojson_files/paths.geojson")
        );

        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== "object" || parsed.type !== "FeatureCollection") {
          throw new Error("paths.geojson is not a valid GeoJSON FeatureCollection");
        }

        if (!cancelled) setPathData(parsed as FeatureCollection);
      } catch (e) {
        console.error("Failed to load paths GeoJSON:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!pathData) return null;

  return (
    <ShapeSource id="paths-source" shape={pathData}>
      <LineLayer
        id="paths-line"
        style={{
          lineColor: "#2563EB",
          lineWidth: 2,
          lineOpacity: 0.75,
        }}
      />
    </ShapeSource>
  );
}
