import { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";
import { buildPathGraphFromGeoJSON } from "../lib/routing/buildPathGraph";
import type { PathGraph } from "../lib/routing/pathfinder";

export function usePathGraph() {
  const [graph, setGraph] = useState<PathGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../../geojson_files/paths.geojson"),
        );
        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== "object" || parsed.type !== "FeatureCollection") {
          throw new Error("paths.geojson is not a valid GeoJSON FeatureCollection");
        }

        const graphResult = buildPathGraphFromGeoJSON(parsed as FeatureCollection);
        if (!cancelled) {
          setGraph(graphResult);
        }
      } catch (e) {
        console.error("Failed to load path graph:", e);
        if (!cancelled) {
          setError("Failed to load path graph");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { graph, error };
}
