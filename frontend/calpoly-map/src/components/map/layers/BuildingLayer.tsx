import React, { useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import {
  FillLayer,
  LineLayer,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

// Color mappings for different building/amenity types
const BUILDING_TYPE_COLORS: Record<string, string> = {
  // Academic buildings
  "academic school or college": "#3B82F6",
  education: "#3B82F6",
  academic: "#3B82F6",
  engineering_building: "#2563EB",
  science_building: "#3B82F6",
  laboratory: "#1D4ED8",
  architecture: "#3B82F6",
  business: "#8B5CF6",

  // Residential buildings
  "hall of residence": "#10B981",
  dormitory: "#10B981",
  residential: "#10B981",

  // Dining
  dining: "#F59E0B",
  cafe: "#FCD34D",
  restaurant: "#F59E0B",

  // Recreation & Performing Arts
  recreation: "#8B5CF6",
  performing_arts: "#A855F7",
  theatre: "#A855F7",

  // Administrative & Services
  administrative: "#EF4444",
  office: "#DC2626",
  police: "#B91C1C",

  // Utilities & Maintenance
  maintenance: "#6B7280",
  warehouse: "#6B7280",

  // Agriculture
  agriculture: "#84CC16",
}

export function BuildingLayer({
  buildingTypes,
  onBuildingPress,
}: {
  buildingTypes?: string[];
  onBuildingPress?: (feature: any) => void;
}) {
  const [buildingData, setBuildingData] = useState<FeatureCollection | null>(null);
  const { setMapDataStatus, mapDataRetryToken } = useMapContext();

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
        setMapDataStatus("buildings", { loading: true, error: null });
        const asset = Asset.fromModule(
          require("../../../../geojson_files/buildings.geojson"),
        );

        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);

        if (
          !parsed ||
          typeof parsed !== "object" ||
          parsed.type !== "FeatureCollection"
        ) {
          throw new Error(
            "buildings.geojson is not a valid GeoJSON FeatureCollection",
          );
        }

        if (!cancelled) {
          setBuildingData(parsed as FeatureCollection);
          setMapDataStatus("buildings", { loading: false });
        }
      } catch (e) {
        console.error("Failed to load buildings GeoJSON:", e);
        if (!cancelled) {
          setBuildingData(null);
          setMapDataStatus("buildings", {
            loading: false,
            error: "Failed to load buildings data.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setMapDataStatus, mapDataRetryToken]);

  if (!buildingData) return null;

  return (
    <ShapeSource
      id="buildings-source"
      shape={buildingData}
      onPress={(event) => {
        if (event.features && event.features.length > 0) {
          const feature = event.features[0];
          console.log('Building tapped:', feature.properties?.name);
        }
        return true;
      }}
    >
      <FillLayer
        id="buildings-fill"
        filter={buildingFilter}
        style={{
          // fillColor: fillColorExpression as any,
          fillColor: "green",
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
