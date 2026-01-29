import React, { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import { addGeoJSONLayer } from "../../../lib/map/loadGeoJSON";

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

  return addGeoJSONLayer({
    id: "class-zones",
    data: zoneData,
    layerType: "circle",
    paint: {
      "circle-radius": 6,
      "circle-color": "#2E86AB",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
    },
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
    },
  });
}
