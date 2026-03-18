import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { FeatureCollection, Point } from "geojson";
import {
  ShapeSource,
  SymbolLayer,
  Images,
} from "@maplibre/maplibre-react-native";
import { useMapContext } from "../../../context/MapContext";

// Icon image mappings for different amenity categories
const AMENITY_ICONS: Record<string, any> = {
  "water-fountain": require("../../../../assets/icons/water-fountain.png"),
  "bathroom": require("../../../../assets/icons/bathroom.png"),
  "printer": require("../../../../assets/icons/printer.png"),
  "elevator": require("../../../../assets/icons/elevator.png"),
};

const DISPLAYED_AMENITY_CATEGORIES = [
  "water_fountain",
  "bathroom",
  "toilet",
  "printer",
  "elevator",
  "lift",
] as const;

// Main component to render the amenities layer on the map
export function AmenitiesLayer({ amenityTypes, visible = true }: { amenityTypes: string[]; visible?: boolean }) {
  const [amenityData, setAmenityData] = useState<FeatureCollection<Point> | null>(null);
  const { setMapDataStatus, mapDataRetryToken, selectAmenity, selectedBuilding, mapMode } = useMapContext();

  const selectedBuildingName = selectedBuilding?.properties?.name ?? null;

  // Build a FeatureCollection of amenities that belong to the selected building
  const highlightedAmenities = useMemo<FeatureCollection<Point> | null>(() => {
    if (!amenityData || !selectedBuildingName || mapMode !== "amenities") return null;
    const matching = amenityData.features.filter((f) => {
      const bldg = f.properties?.building;
      if (!bldg || typeof bldg !== "string") return false;
      return bldg.includes(selectedBuildingName);
    });
    if (matching.length === 0) return null;
    return { type: "FeatureCollection", features: matching };
  }, [amenityData, selectedBuildingName, mapMode]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMapDataStatus("amenities", { loading: true, error: null });
        const asset = Asset.fromModule(
          require("../../../../geojson_files/amenities.geojson"),
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
            "amenities.json is not a valid GeoJSON FeatureCollection",
          );
        }

        if (!cancelled) {
          setAmenityData(parsed as FeatureCollection<Point>);
          setMapDataStatus("amenities", { loading: false });
        }
      } catch (e) {
        console.error("Failed to load amenities data:", e);
        if (!cancelled) {
          setAmenityData(null);
          setMapDataStatus("amenities", {
            loading: false,
            error: "Failed to load amenities data.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setMapDataStatus, mapDataRetryToken]);

  // Create icon image expression - map category to icon name
  const iconImageExpression = useMemo(() => {
    return [
      "match",
      ["get", "category"],
      "water_fountain", "water-fountain",
      "bathroom", "bathroom",
      "toilet", "bathroom",
      "printer", "printer",
      "elevator", "elevator",
      "lift", "elevator",
      "water-fountain" // default
    ] as any;
  }, []);

  // When not visible, use a filter that matches nothing so native layers stay mounted
  // If no amenity types are selected, show all amenities
  // Otherwise, filter to only show selected types
  // Expand "bathroom" to also match "toilet" (GeoJSON uses "toilet" as the category)
  const expandedTypes = useMemo(() => {
    if (amenityTypes.length === 0) return [];
    const types = [...amenityTypes];
    if (types.includes("bathroom") && !types.includes("toilet")) {
      types.push("toilet");
    }
    if (types.includes("elevator") && !types.includes("lift")) {
      types.push("lift");
    }
    return types;
  }, [amenityTypes]);

  const filter = expandedTypes.length === 0
    ? [
        "in",
        ["get", "category"],
        ["literal", DISPLAYED_AMENITY_CATEGORIES],
      ]
    : [
        "in",
        ["get", "category"],
        ["literal", expandedTypes],
      ];

  const handlePress = useCallback(
    (event: any) => {
      if (!event.features || event.features.length === 0 || !amenityData) return;
      const feature = event.features[0];
      const category = feature.properties?.category;
      const building = feature.properties?.building;

      // Find all levels where this amenity category exists in the same building
      const levels: number[] = [];
      for (const f of amenityData.features) {
        if (
          f.properties?.category === category &&
          f.properties?.building === building &&
          f.properties?.level != null
        ) {
          const level = Number(f.properties.level);
          if (!levels.includes(level)) {
            levels.push(level);
          }
        }
      }
      levels.sort((a, b) => a - b);

      selectAmenity(feature, levels);
    },
    [amenityData, selectAmenity],
  );

  const EMPTY_FC: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

  const activeShape = !amenityData || mapMode !== "amenities"
    ? EMPTY_FC
    : (highlightedAmenities ?? amenityData);

  return (
    <>
      {/* Load icon images */}
      <Images images={AMENITY_ICONS} />

      <ShapeSource id="amenities-source" shape={activeShape} onPress={handlePress}>
        {/* Icon-based symbol layer */}
        <SymbolLayer
          id="amenities-layer"
          aboveLayerID="buildings-outline"
          filter={filter as any}
          style={{
            iconImage: iconImageExpression,
            iconSize: [
              "interpolate",
              ["linear"],
              ["zoom"],
              13, 0.2,   // At zoom 13, 20% size
              15, 0.3,   // At zoom 15, 30% size
              17, 0.4,   // At zoom 17, 40% size
              19, 0.5,   // At zoom 19, 50% size
            ] as any,
            iconAllowOverlap: true,
            // Keep amenity icons visible even when points are very close together.
            iconIgnorePlacement: true,
            iconAnchor: "bottom",
          }}
        />
      </ShapeSource>
    </>
  );
}
