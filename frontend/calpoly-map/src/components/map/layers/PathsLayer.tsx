import React, { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import { addGeoJSONLayer } from "../../../lib/map/loadGeoJSON";
import { useMapContext } from "../../../context/MapContext";

export function PathsLayer() {
  const [pathData, setPathData] = useState<FeatureCollection | null>(null);
  const { setMapDataStatus, mapDataRetryToken } = useMapContext();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMapDataStatus("paths", { loading: true, error: null });
        // From: src/components/map/layers/PathsLayer.tsx
        // To:   geojson_files/paths.geojson
        const asset = Asset.fromModule(
          require("../../../../geojson_files/paths.geojson")
        );

        // Make sure it's available locally
        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        // Validate it's a FeatureCollection
        if (!parsed || typeof parsed !== "object" || parsed.type !== "FeatureCollection") {
          throw new Error("paths.geojson is not a valid GeoJSON FeatureCollection");
        }

        if (!cancelled) {
          setPathData(parsed as FeatureCollection);
          setMapDataStatus("paths", { loading: false });
        }
      } catch (e) {
        console.error("Failed to load paths GeoJSON:", e);
        if (!cancelled) {
          setPathData(null);
          setMapDataStatus("paths", {
            loading: false,
            error: "Failed to load paths data.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setMapDataStatus, mapDataRetryToken]);

  if (!pathData) return null;

  return addGeoJSONLayer({
    id: "paths",
    data: pathData,
    fillOpacity: 0, // No fill for paths
    outlineColor: "#3B82F6", // Blue color for paths
    outlineWidth: 3, // Appropriate width for visibility
  });
}
