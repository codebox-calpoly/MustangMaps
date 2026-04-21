import React, { useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection, GeoJsonProperties } from "geojson";

import {
  FillLayer,
  LineLayer,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";
import { useSavedPlaces } from "../../../context/SavedPlacesContext";

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
  const { setMapDataStatus, mapDataRetryToken, mapStyle, mapMode } = useMapContext();
  const { favorites } = useSavedPlaces();
  const dark = mapStyle === "dark";

  const favoriteMatchers = useMemo(() => {
    const refs = new Set<string>();
    const names = new Set<string>();
    for (const fav of favorites) {
      if (fav.ref) refs.add(String(fav.ref).trim());
      if (fav.name) {
        const stripped = fav.name.replace(/\s*\(\d+\)\s*$/, "").trim().toLowerCase();
        if (stripped) names.add(stripped);
      }
    }
    return { refs, names };
  }, [favorites]);

  // When in amenities mode, ignore the building filter so all buildings
  // display at normal opacity. The filter state is preserved in context
  // and re-applied when the user switches back to buildings mode.
  const effectiveBuildingTypes = mapMode === "buildings" ? buildingTypes : [];

  const normalizedBuildingTypes = useMemo(
    () => effectiveBuildingTypes.map((value) => normalizeValue(value)),
    [effectiveBuildingTypes],
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
        const rawName = String(feature.properties?.name ?? "").trim();
        const displayName = rawName.replace(/\s*\(\d+\)\s*$/, "").trim();
        const ref = String(feature.properties?.ref ?? "").trim();
        const isFavorite =
          (ref.length > 0 && favoriteMatchers.refs.has(ref)) ||
          (displayName.length > 0 &&
            favoriteMatchers.names.has(displayName.toLowerCase()));
        return {
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            filter_all: true,
            filter_academic: categories.has("academic"),
            filter_residential: categories.has("residential"),
            filter_dining: categories.has("dining"),
            filter_favorite: isFavorite,
            displayName,
          },
        };
      }),
    } as FeatureCollection;
  }, [buildingData, favoriteMatchers]);

  // When "All" is selected (no specific types), show every building at full
  // opacity. When a specific category is active, dim buildings outside it.
  const buildingFilter = useMemo(() => {
    if (normalizedBuildingTypes.length === 0) return null;

    const allChecks = {
      academic: ["==", ["get", "filter_academic"], true] as const,
      residential: ["==", ["get", "filter_residential"], true] as const,
      dining: ["==", ["get", "filter_dining"], true] as const,
      favorites: ["==", ["get", "filter_favorite"], true] as const,
    };

    const includesAll =
      normalizedBuildingTypes.length === 0 ||
      normalizedBuildingTypes.includes("all");

    if (includesAll) {
      return ["==", ["get", "filter_all"], true] as const;
    }

    const selectedTypes = normalizedBuildingTypes.filter(
      (type): type is keyof typeof allChecks => type in allChecks,
    );

    const checks = selectedTypes.map((type) => allChecks[type]);

    if (checks.length === 0) {
      return ["==", 1, 1] as const;
    }

    return ["any", ...checks] as const;
  }, [normalizedBuildingTypes]);

  const buildingFillOpacity = useMemo(() => {
    if (!buildingFilter) {
      return 0.3;
    }
    
    return ["case", buildingFilter, 0.7, 0.3] as const;
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
            "added-amenities-building.geojson is not a valid GeoJSON FeatureCollection",
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
    <>
    <ShapeSource
      id="buildings-source"
      shape={categorizedBuildingData}
      hitbox={{ width: 44, height: 44 }}
      onPress={(event) => {
        if (!event.features || event.features.length === 0) return true;

        const tap = event.coordinates;

        // Ray-casting point-in-polygon test
        const pointInRing = (ring: number[][], px: number, py: number) => {
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

        if (!tap) return true;

        const px = tap.longitude;
        const py = tap.latitude;

        // Find the feature whose polygon actually contains the tap point
        let best: any = null;
        for (const f of event.features) {
          const rings = getRings(f);
          if (rings.length > 0 && pointInRing(rings[0], px, py)) {
            best = f;
            break;
          }
        }

        // If no exact hit, fall back to the smallest-area candidate.
        // The hitbox already limits candidates to nearby features, so the
        // smallest polygon is almost always the one the user intended.
        if (!best && event.features.length > 0) {
          let minArea = Infinity;
          for (const f of event.features) {
            const rings = getRings(f);
            if (rings.length === 0) continue;
            const ring = rings[0];
            // Shoelace formula for polygon area
            let area = 0;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              area += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
            }
            area = Math.abs(area / 2);
            if (area < minArea) {
              minArea = area;
              best = f;
            }
          }
        }

        if (!best) return true;

        // Attach the actual tap coordinates so the marker can be placed
        // exactly where the user tapped instead of at the polygon centroid.
        const withTap = {
          ...best,
          properties: {
            ...(best.properties ?? {}),
            _tapLng: tap.longitude,
            _tapLat: tap.latitude,
          },
        };
        onBuildingPress?.(withTap);
        return true;
      }}
    >
      <FillLayer
        id="buildings-fill"
        style={{
          fillColor: "#36a33a",
          fillOpacity: buildingFillOpacity,
          fillOpacityTransition: { duration: 200, delay: 0 },
        }}
      />
      <LineLayer
        id="buildings-outline"
        style={{
          lineColor: dark ? "#86EFAC" : "#000000",
          lineWidth: 1.5,
          lineOpacity: buildingOutlineOpacity,
          lineOpacityTransition: { duration: 200, delay: 0 },
        }}
      />
    </ShapeSource>
    <ShapeSource
      id="buildings-labels-source"
      shape={categorizedBuildingData}
    >
      <SymbolLayer
        id="buildings-label"
        minZoomLevel={17}
        filter={["has", "displayName"]}
        style={{
          textField: ["get", "displayName"],
          textSize: [
            "interpolate",
            ["linear"],
            ["zoom"],
            17, 10,
            19, 12,
            21, 14,
          ],
          textMaxWidth: 8,
          textAllowOverlap: false,
          textIgnorePlacement: false,
          textOptional: true,
          textPadding: 2,
          textColor: dark ? "#F9FAFB" : "#111827",
          textHaloColor: dark ? "#000000" : "#FFFFFF",
          textHaloWidth: 1.25,
          textHaloBlur: 0.5,
          textOpacity: buildingOutlineOpacity,
        }}
      />
    </ShapeSource>
    </>
  );
}
