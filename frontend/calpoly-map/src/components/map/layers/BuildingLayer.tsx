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
  const { setMapDataStatus, mapDataRetryToken, mapStyle } = useMapContext();
  const dark = mapStyle === "dark";

  const normalizedBuildingTypes = useMemo(
    () => buildingTypes.map((value) => normalizeValue(value)),
    [buildingTypes],
  );

  const categorizedBuildingData = useMemo(() => {
    if (!buildingData) {
      return null;
    }

    // Deduplicate by @id and drop Point features (only Polygon/MultiPolygon
    // are useful for fill/line layers). Duplicate polygons with the same @id
    // cause double-rendering at 25% opacity, making some buildings darker.
    const seen = new Set<string>();
    const deduped = buildingData.features.filter((feature) => {
      const geomType = feature.geometry?.type;
      if (geomType !== "Polygon" && geomType !== "MultiPolygon") {
        return false;
      }
      const id = feature.properties?.["@id"];
      if (id) {
        if (seen.has(id)) return false;
        seen.add(id);
      }
      return true;
    });

    return {
      ...buildingData,
      features: deduped.map((feature) => {
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

  // When "All" is selected (no specific types), show every building at full
  // opacity. When a specific category is active, dim buildings outside it.
  const buildingFilter = useMemo(() => {
    if (normalizedBuildingTypes.length === 0) return null;

    const allChecks = {
      academic: ["==", ["get", "filter_academic"], true] as const,
      residential: ["==", ["get", "filter_residential"], true] as const,
      dining: ["==", ["get", "filter_dining"], true] as const,
    };

    const selectedTypes = normalizedBuildingTypes.filter(
      (type): type is keyof typeof allChecks => type in allChecks,
    );

    const checks = selectedTypes.map((type) => allChecks[type]);

    if (checks.length === 0) {
      // Unknown filter values should match nothing.
      return ["==", 1, 0] as const;
    }

    return ["any", ...checks] as const;
  }, [normalizedBuildingTypes]);

  const buildingFillOpacity = useMemo(() => {
    if (!buildingFilter) return 0.3;
    return ["case", buildingFilter, 0.3, 0.08] as const;
  }, [buildingFilter]);

  const buildingOutlineOpacity = useMemo(() => {
    if (!buildingFilter) return 1;
    return ["case", buildingFilter, 1, 0.35] as const;
  }, [buildingFilter]);

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
      hitbox={{ width: 20, height: 20 }}
      onPress={(event) => {
        if (!event.features || event.features.length === 0) return true;

        const tap = event.coordinates;
        let best = event.features[0];

        if (tap && event.features.length > 1) {
          const px = tap.longitude;
          const py = tap.latitude;

          // Ray-casting point-in-polygon test
          const pointInRing = (ring: number[][]) => {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const xi = ring[i][0], yi = ring[i][1];
              const xj = ring[j][0], yj = ring[j][1];
              if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
                inside = !inside;
              }
            }
            return inside;
          };

          const getRings = (f: any): number[][][] => {
            const geom = f.geometry;
            if (!geom?.coordinates) return [];
            if (geom.type === "Polygon") return geom.coordinates;
            if (geom.type === "MultiPolygon") return geom.coordinates.flat();
            return [];
          };

          // First pass: find the feature whose polygon contains the tap point
          for (const f of event.features) {
            const rings = getRings(f);
            if (rings.length > 0 && pointInRing(rings[0])) {
              best = f;
              break;
            }
          }
        }

        // Attach the actual tap coordinates so the marker can be placed
        // exactly where the user tapped instead of at the polygon centroid.
        const withTap = {
          ...best,
          properties: {
            ...(best.properties ?? {}),
            ...(tap ? { _tapLng: tap.longitude, _tapLat: tap.latitude } : {}),
          },
        };
        onBuildingPress?.(withTap);
        return true;
      }}
    >
      <FillLayer
        id="buildings-fill"
        style={{
          fillColor: "green",
          fillOpacity: buildingFillOpacity,
        }}
      />
      <LineLayer
        id="buildings-outline"
        style={{
          lineColor: dark ? "#86EFAC" : "#111827",
          lineWidth: 1,
          lineOpacity: buildingOutlineOpacity,
        }}
      />
    </ShapeSource>
  );
}
