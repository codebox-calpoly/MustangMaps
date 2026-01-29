import React from "react";
import type { FeatureCollection, Point } from "geojson";
import {
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import features from "../../../../geojson_files/amenities.json";

// added symbol layer, removed circle layer

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

// replaced, my indents were weird, but removed circlelayer added symbollayer
return (
  <ShapeSource id={sourceId} shape={data}>
    <SymbolLayer
      id={layerId}
      filter={["in", ["get", "category"], ["literal", amenityTypes]]}
      style={{
        iconImage: [
          "match",
          ["get", "category"],
          "bathroom", "amenity-bathroom",
          "water_fountain", "amenity-water-fountain",
          "printer", "amenity-printer",
          "classroom", "amenity-classroom",
          "amenity-default",
        ],
        iconSize: 1,
        iconAllowOverlap: true,
        iconAnchor: "center",
      }}
    />
  </ShapeSource>
);


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