import React from "react";
import type { FeatureCollection, Point } from "geojson";
import {
  ShapeSource,
  CircleLayer,
} from "@maplibre/maplibre-react-native";
import features from "../../../../geojson_files/amenities.json";

// Define the categories of amenities to be displayed. Leave empty to show none.
const amenityCategories : string[] = ["bathroom", "printer", "water_fountain"];

// Function to add a GeoJSON layer with specified styling and filtering
type AddGeoJSONLayerArgs = {
  sourceId: string;
  layerId: string;
  data: FeatureCollection<Point>;
  amenityTypes: string[];
  circleStyle: {
    circleRadius: number;
    circleColor: string;
    circleStrokeWidth: number;
    circleStrokeColor: string;
  };
};

function addGeoJSONLayer({
  sourceId,
  layerId,
  data,
  amenityTypes,
  circleStyle,
}: AddGeoJSONLayerArgs) {
  return (
    <ShapeSource id={sourceId} shape={data}>
      <CircleLayer
        id={layerId}
        filter={[
          "in",
          ["get", "category"],
          ["literal", amenityTypes],
        ]}
        style={circleStyle}
      />
    </ShapeSource>
  );
}

// Main component to render the amenities layer on the map
export function AmenitiesLayer() {
  return (
    <>
      {addGeoJSONLayer({
        sourceId: "amenities-source",
        layerId: "amenities-layer",
        data: features as FeatureCollection<Point>,
        amenityTypes: amenityCategories,
        circleStyle: {
          circleRadius: 8,
          circleColor: "#fff422ff",
          circleStrokeWidth: 2,
          circleStrokeColor: "#ffffffff",
        },
      })}
    </>
  );
}