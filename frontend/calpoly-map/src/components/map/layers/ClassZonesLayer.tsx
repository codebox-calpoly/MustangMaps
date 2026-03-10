import React, { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";
import { ShapeSource, CircleLayer, SymbolLayer, FillLayer, LineLayer } from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

export function ClassZonesLayer() {
  const [zoneData, setZoneData] = useState<FeatureCollection | null>(null);
  const { setMapDataStatus, mapDataRetryToken, mapStyle } = useMapContext();
  const isDark = mapStyle === "dark";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMapDataStatus("class-zones", { loading: true, error: null });
        // From: src/components/map/layers/ClassZonesLayer.tsx
        // To:   geojson_files/class_zones/class_zones2.geojson
        const asset = Asset.fromModule(
          require("../../../../geojson_files/class_zones/class_zones2.geojson")
        );

        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        if (!parsed || parsed.type !== "FeatureCollection") {
          throw new Error("class_zones2.geojson is not a valid FeatureCollection");
        }

        if (!cancelled) {
          setZoneData(parsed as FeatureCollection);
          setMapDataStatus("class-zones", { loading: false });
        }
      } catch (e) {
        console.error("Failed to load class zones GeoJSON:", e);
        if (!cancelled) {
          setZoneData(null);
          setMapDataStatus("class-zones", {
            loading: false,
            error: "Failed to load class zones.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setMapDataStatus, mapDataRetryToken]);

  if (!zoneData) return null;

  return (
    <ShapeSource id="class-zones-source" shape={zoneData}>

    
      <FillLayer
        id="class-zones-fill"
        style={{
          fillColor: [
            "match",
            ["get", "label"],
            "Left", "#97e0ff",
            "Right", "#dbbdff",
            "#9c9494",
          ],
          fillOpacity: 1,
        }}
      />
      <LineLayer
        id="class-zones-line"
        style={{
          lineColor: "#111827",
          lineWidth: 1,
        }}
      />
    </ShapeSource>
  );
}
