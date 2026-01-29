import React, { useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import { FillLayer, LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";

export function BuildingLayer({ buildingTypes }: { buildingTypes?: string[] }) {
  const [buildingData, setBuildingData] = useState<FeatureCollection | null>(null);
  const buildingFilter = useMemo(() => {
    if (!buildingTypes || buildingTypes.length === 0) {
      return undefined;
    }
    return ["in", ["get", "building"], ["literal", buildingTypes]] as const;
  }, [buildingTypes]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // From: src/components/map/layers/BuildingLayer.tsx
        // To:   geojson_files/buildings.geojson (project root)
        const asset = Asset.fromModule(
          require("../../../../geojson_files/buildings.geojson")
        );

        // make sure it's available locally
        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        // Validate it's a FeatureCollection (what ShapeSource expects)
        if (!parsed || typeof parsed !== "object" || parsed.type !== "FeatureCollection") {
          throw new Error("buildings.geojson is not a valid GeoJSON FeatureCollection");
        }

        if (!cancelled) setBuildingData(parsed as FeatureCollection);
      } catch (e) {
        console.error("Failed to load buildings GeoJSON:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!buildingData) return null;

  return (
    <ShapeSource id="buildings-source" shape={buildingData}>
      <FillLayer
        id="buildings-fill"
        filter={buildingFilter}
        style={{
          fillColor: "#6B7280",
          fillOpacity: 0.25,
        }}
      />
      <LineLayer
        id="buildings-outline"
        filter={buildingFilter}
        style={{
          lineColor: "#111827",
          lineWidth: 1,
        }}
      />
    </ShapeSource>
  );
}
