import React, { useMemo } from "react";
import type { FeatureCollection, Point } from "geojson";
import {
  ShapeSource,
  SymbolLayer,
  CircleLayer,
} from "@maplibre/maplibre-react-native";
import features from "../../../../geojson_files/amenities.json";

// Color mappings for different amenity categories
const AMENITY_COLORS: Record<string, string> = {
  water_fountain: "#2196F3",  // Blue
  bathroom: "#9C27B0",          // Purple
  printer: "#FF9800",           // Orange
};

// Emoji/text symbols for different amenity categories
const AMENITY_SYMBOLS: Record<string, string> = {
  water_fountain: "💧",
  bathroom: "🚻",
  printer: "🖨️",
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
  // Create match expressions for color and symbol based on category
  const colorExpression = useMemo(() => {
    const expr: any[] = ["match", ["get", "category"]];
    Object.entries(AMENITY_COLORS).forEach(([category, color]) => {
      expr.push(category, color);
    });
    expr.push("#999999"); // Default gray
    return expr;
  }, []);

  const textExpression = useMemo(() => {
    const expr: any[] = ["match", ["get", "category"]];
    Object.entries(AMENITY_SYMBOLS).forEach(([category, symbol]) => {
      expr.push(category, symbol);
    });
    expr.push("📍"); // Default pin
    return expr;
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
    <ShapeSource id={sourceId} shape={data}>
      {/* Colored circle markers */}
      <CircleLayer
        id={`${layerId}-circle`}
        filter={filter}
        style={{
          circleRadius: [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 8,   // At zoom 13, radius is 8px
            15, 12,  // At zoom 15, radius is 12px
            17, 16,  // At zoom 17, radius is 16px
            19, 20,  // At zoom 19, radius is 20px
          ] as any,
          circleColor: colorExpression as any,
          circleOpacity: 0.95,
          circleStrokeWidth: 3,
          circleStrokeColor: "#ffffff",
          circleStrokeOpacity: 1.0,
        }}
      />
      {/* Symbol overlay - try simple text first */}
      <SymbolLayer
        id={`${layerId}-symbol`}
        filter={filter}
        style={{
          textField: textExpression as any,
          textSize: [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 12,  // At zoom 13, text is 12px
            15, 16,  // At zoom 15, text is 16px
            17, 20,  // At zoom 17, text is 20px
            19, 24,  // At zoom 19, text is 24px
          ] as any,
          textColor: "#ffffff",
          textHaloColor: "#000000",
          textHaloWidth: 1,
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </ShapeSource>
  );
}

// Main component to render the amenities layer on the map
export function AmenitiesLayer({ amenityTypes }: { amenityTypes: string[] }) {
  console.log('AmenitiesLayer rendering with types:', amenityTypes);
  console.log('Amenity features count:', (features as FeatureCollection<Point>).features.length);

  return addGeoJSONLayer({
    sourceId: "amenities-source",
    layerId: "amenities-layer",
    data: features as FeatureCollection<Point>,
    amenityTypes,
  });
}
