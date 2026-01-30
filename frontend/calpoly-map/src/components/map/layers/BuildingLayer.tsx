import React, { useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection } from "geojson";

import { FillLayer, LineLayer, ShapeSource } from "@maplibre/maplibre-react-native";

// Color mappings for building types and amenities
const BUILDING_TYPE_COLORS: Record<string, string> = {
  // University function types (most specific - from "university-function" property)
  "academic school or college": "#3B82F6",  // Blue - Academic buildings
  "hall of residence": "#10B981",           // Green - Residence halls

  // Building use types (from "building:use" property)
  "education": "#3B82F6",     // Blue - Educational use
  "office": "#EF4444",        // Red - Office buildings

  // Building types (from "building" property)
  university: "#9CA3AF",      // Light gray - Generic university buildings
  dormitory: "#10B981",       // Green - Housing/dorms
  residential: "#10B981",     // Green - Residential
  house: "#10B981",           // Green - Houses
  apartments: "#10B981",      // Green - Apartments
  school: "#3B82F6",          // Blue - Schools
  greenhouse: "#22C55E",      // Bright green - Greenhouses
  shed: "#78716C",            // Stone - Sheds
  roof: "#6B7280",            // Gray - Roof structures
  yes: "#D1D5DB",             // Light gray - Generic buildings

  // Amenity types (from "amenity" property)
  library: "#06B6D4",         // Cyan - Libraries
  college: "#3B82F6",         // Blue - College buildings
  theatre: "#8B5CF6",         // Purple - Theatre/arts
  parking: "#6B7280",         // Gray - Parking
  bicycle_parking: "#78716C", // Stone - Bike parking
  police: "#EF4444",          // Red - Police/security
  fast_food: "#F59E0B",       // Orange - Dining/food
  restaurant: "#F59E0B",      // Orange - Restaurants
  cafe: "#F59E0B",            // Orange - Cafes

  // Additional common types
  laboratory: "#EC4899",      // Pink - Labs/research
  health: "#14B8A6",          // Teal - Health services
  administrative: "#EF4444",  // Red - Admin buildings
  recreation: "#8B5CF6",      // Purple - Recreation/sports
  maintenance: "#78716C",     // Stone - Maintenance/utilities
};

// Default color for buildings without a defined type
const DEFAULT_BUILDING_COLOR = "#6B7280"; // Gray

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

  // Create a MapLibre match expression for data-driven styling
  // Check properties in priority order: university-function > building:use > amenity > building
  const fillColorExpression = useMemo(() => {
    const matchExpression: any[] = [
      "match",
      // Use coalesce to check properties from most specific to most generic
      [
        "coalesce",
        ["get", "university-function"], // Most specific - university building function
        ["get", "building:use"],        // Specific - building use
        ["get", "amenity"],             // Specific - amenity type
        ["get", "building"],            // Generic - building type
        "",
      ],
    ];

    // Add color mappings for each building/amenity type
    Object.entries(BUILDING_TYPE_COLORS).forEach(([type, color]) => {
      matchExpression.push(type, color);
    });

    // Add default color as fallback
    matchExpression.push(DEFAULT_BUILDING_COLOR);

    return matchExpression;
  }, []);

  if (!buildingData) return null;

  return (
    <ShapeSource id="buildings-source" shape={buildingData}>
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
