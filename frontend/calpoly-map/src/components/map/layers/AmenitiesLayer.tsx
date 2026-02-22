import React, { useEffect, useMemo, useState } from "react";
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
};

// Main component to render the amenities layer on the map
export function AmenitiesLayer({ amenityTypes }: { amenityTypes: string[] }) {
  const [amenityData, setAmenityData] = useState<FeatureCollection<Point> | null>(null);
  const { setMapDataStatus, mapDataRetryToken } = useMapContext();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMapDataStatus("amenities", { loading: true, error: null });
        const asset = Asset.fromModule(
          require("../../../../geojson_files/amenities.json"),
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
      "printer", "printer",
      "water-fountain" // default
    ] as any;
  }, []);

  // If no amenity types are selected, show all amenities
  // Otherwise, filter to only show selected types
  const filter = amenityTypes.length === 0
    ? ["has", "category"] // Show all features that have a category property
    : [
        "in",
        ["get", "category"],
        ["literal", amenityTypes],
      ];

  if (!amenityData) return null;

  return (
    <>
      {/* Load icon images */}
      <Images images={AMENITY_ICONS} />

      <ShapeSource id="amenities-source" shape={amenityData}>
        {/* Icon-based symbol layer */}
        <SymbolLayer
          id="amenities-layer"
          filter={filter}
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
            iconIgnorePlacement: false,
            iconAnchor: "bottom",
          }}
        />
      </ShapeSource>
    </>
  );
}
