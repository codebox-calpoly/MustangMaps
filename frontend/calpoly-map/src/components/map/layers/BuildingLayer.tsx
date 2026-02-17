import React, { useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection, GeoJsonProperties } from "geojson";

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

const ACADEMIC_AMENITIES = new Set([
  "academic",
  "education",
  "engineering_building",
  "science_building",
  "laboratory",
  "architecture",
  "business",
  "library",
]);

const RESIDENTIAL_BUILDING_TYPES = new Set([
  "dormitory",
  "residential",
  "apartments",
]);

const DINING_AMENITIES = new Set([
  "dining",
  "restaurant",
  "cafe",
  "fast_food",
  "food_court",
]);

function normalizeValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function categorizeBuilding(properties?: GeoJsonProperties | null): Set<string> {
  const categories = new Set<string>();
  const buildingType = normalizeValue(properties?.building);
  const amenityType = normalizeValue(properties?.amenity);
  const universityFunction = normalizeValue(properties?.["university-function"]);

  if (
    buildingType === "university" ||
    buildingType === "school" ||
    universityFunction === "academic_school_or_college" ||
    ACADEMIC_AMENITIES.has(amenityType)
  ) {
    categories.add("academic");
  }

  if (
    universityFunction === "hall_of_residence" ||
    RESIDENTIAL_BUILDING_TYPES.has(buildingType) ||
    amenityType === "dormitory"
  ) {
    categories.add("residential");
  }

  if (DINING_AMENITIES.has(amenityType)) {
    categories.add("dining");
  }

  return categories;
}

export function BuildingLayer({
  buildingTypes,
  onBuildingPress,
}: {
  buildingTypes: string[];
  onBuildingPress?: (feature: any) => void;
}) {
  const [buildingData, setBuildingData] = useState<FeatureCollection | null>(null);
  const { setMapDataStatus, mapDataRetryToken } = useMapContext();

  const normalizedBuildingTypes = useMemo(
    () => buildingTypes.map((value) => normalizeValue(value)),
    [buildingTypes],
  );

  const categorizedBuildingData = useMemo(() => {
    if (!buildingData) {
      return null;
    }

    return {
      ...buildingData,
      features: buildingData.features.map((feature) => {
        const categories = categorizeBuilding(feature.properties);
        return {
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            filter_academic: categories.has("academic"),
            filter_residential: categories.has("residential"),
            filter_dining: categories.has("dining"),
          },
        };
      }),
    } as FeatureCollection;
  }, [buildingData]);

  const buildingFilter = useMemo(() => {
    // "All" or no selected building types should show every building.
    if (normalizedBuildingTypes.length === 0) {
      return undefined;
    }

    const checks: any[] = [];
    if (normalizedBuildingTypes.includes("academic")) {
      checks.push(["==", ["get", "filter_academic"], true]);
    }
    if (normalizedBuildingTypes.includes("residential")) {
      checks.push(["==", ["get", "filter_residential"], true]);
    }
    if (normalizedBuildingTypes.includes("dining")) {
      checks.push(["==", ["get", "filter_dining"], true]);
    }

    if (checks.length === 0) {
      // Unknown filter values should match nothing.
      return ["==", 1, 0] as const;
    }

    return ["any", ...checks] as const;
  }, [normalizedBuildingTypes]);

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

  if (!categorizedBuildingData) return null;

  return (
    <ShapeSource
      id="buildings-source"
      shape={categorizedBuildingData}
      onPress={(event) => {
        if (event.features && event.features.length > 0) {
          const feature = event.features[0];
          console.log('Building tapped:', feature.properties?.name);
          onBuildingPress?.(feature);
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
