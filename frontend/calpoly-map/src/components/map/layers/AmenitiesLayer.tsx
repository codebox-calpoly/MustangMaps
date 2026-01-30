import React, { useMemo } from "react";
import type { FeatureCollection, Point } from "geojson";
import {
  ShapeSource,
  SymbolLayer,
  Images,
} from "@maplibre/maplibre-react-native";
import features from "../../../../geojson_files/amenities.json";

// Icon image mappings for different amenity categories
const AMENITY_ICONS: Record<string, any> = {
  "water-fountain": require("../../../../assets/icons/water-fountain.png"),
  "bathroom": require("../../../../assets/icons/bathroom.png"),
  "printer": require("../../../../assets/icons/printer.png"),
};

// Function to add a GeoJSON layer with icon-based symbols
type AddGeoJSONLayerArgs = {
  sourceId: string;
  layerId: string;
  data: FeatureCollection<Point>;
  amenityTypes: string[];
};

function addGeoJSONLayer({
  sourceId,
  layerId,
  data,
  amenityTypes,
}: AddGeoJSONLayerArgs) {
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

  return (
    <>
      {/* Load icon images */}
      <Images images={AMENITY_ICONS} />

      <ShapeSource id={sourceId} shape={data}>
        {/* Icon-based symbol layer */}
        <SymbolLayer
          id={layerId}
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

// Main component to render the amenities layer on the map
export function AmenitiesLayer({ amenityTypes }: { amenityTypes: string[] }) {
  return addGeoJSONLayer({
    sourceId: "amenities-source",
    layerId: "amenities-layer",
    data: features as FeatureCollection<Point>,
    amenityTypes,
  });
}
