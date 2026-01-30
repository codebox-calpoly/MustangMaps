import React, { useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import { FillLayer, LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";

// Color mappings for building types and amenities
const BUILDING_TYPE_COLORS: Record<string, string> = {
  // University function types
  "academic school or college": "#3B82F6",
  "hall of residence": "#10B981",

  // Building use types
  "education": "#3B82F6",
  "office": "#EF4444",

  // Amenity types - Academic
  academic: "#3B82F6",
  engineering_building: "#2563EB",
  science_building: "#3B82F6",
  computer_science: "#6366F1",
  architecture: "#3B82F6",
  business: "#3B82F6",
  mathematics: "#3B82F6",
  library: "#06B6D4",

  // Residential
  dormitory: "#10B981",

  // Arts & Recreation
  performing_arts: "#8B5CF6",
  theatre: "#8B5CF6",
  recreation: "#A855F7",

  // Dining
  dining: "#F59E0B",
  fast_food: "#F59E0B",
  restaurant: "#F59E0B",
  cafe: "#FBBF24",

  // Administrative
  administrative: "#EF4444",
  student_services: "#EF4444",
  police: "#DC2626",
  post_depot: "#EF4444",

  // Agricultural
  agriculture: "#22C55E",

  // Utilities
  maintenance: "#78716C",
  parking: "#6B7280",
  parking_entrance: "#6B7280",
  bicycle_parking: "#78716C",

  // Health
  health: "#14B8A6",

  // Miscellaneous
  miscellaneous: "#94A3B8",
  community_centre: "#A855F7",

  // Building types fallback
  university: "#9CA3AF",
  residential: "#10B981",
  house: "#10B981",
  apartments: "#10B981",
  school: "#3B82F6",
  greenhouse: "#22C55E",
  shed: "#78716C",
  roof: "#6B7280",
  yes: "#D1D5DB",
  college: "#3B82F6",
  laboratory: "#EC4899",
};

const DEFAULT_BUILDING_COLOR = "#6B7280";

export function BuildingLayer({
  buildingTypes,
  onBuildingPress,
}: {
  buildingTypes?: string[];
  onBuildingPress?: (feature: any) => void;
}) {
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

  // Create MapLibre match expression for data-driven styling
  const fillColorExpression = useMemo(() => {
    const matchExpression: any[] = [
      "match",
      [
        "coalesce",
        ["get", "university-function"],
        ["get", "building:use"],
        ["get", "amenity"],
        ["get", "building"],
        "",
      ],
    ];

    Object.entries(BUILDING_TYPE_COLORS).forEach(([type, color]) => {
      matchExpression.push(type, color);
    });

    matchExpression.push(DEFAULT_BUILDING_COLOR);
    return matchExpression;
  }, []);

  if (!buildingData) return null;

  return (
    <ShapeSource
      id="buildings-source"
      shape={buildingData}
      onPress={(event) => {
        // OnPressEvent has features array, not a single feature
        if (event.features && event.features.length > 0) {
          const feature = event.features[0];
          console.log('Building tapped:', feature.properties?.name);

          // Call the callback directly (works on iOS)
          if (onBuildingPress) {
            onBuildingPress(feature);
          } else {
            console.warn('onBuildingPress callback not available');
          }
        }
        return true;
      }}
    >
      <FillLayer
        id="buildings-fill"
        filter={buildingFilter}
        style={{
          fillColor: fillColorExpression as any,
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
