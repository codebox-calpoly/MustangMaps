import React, { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import { addGeoJSONLayer } from "../../../lib/map/loadGeoJSON";

export function BuildingLayer() {
  const [buildingData, setBuildingData] = useState<FeatureCollection | null>(null);

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

  return addGeoJSONLayer({
    id: "buildings", // <-- this is just your layer name/id (NOT a field in the geojson file)
    data: buildingData,
    fillColor: "#6B7280",
    fillOpacity: 0.25,
    outlineColor: "#111827",
    outlineWidth: 1,
  });
}
