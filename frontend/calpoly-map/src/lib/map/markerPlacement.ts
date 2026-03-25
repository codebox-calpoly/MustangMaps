import type { Feature, GeoJsonProperties, Geometry, Point, FeatureCollection } from "geojson";

/**
 * Compute the centroid of a GeoJSON feature by averaging ring coordinates.
 */
export function featureCenter(
  feature: Feature<Geometry, GeoJsonProperties>,
): [number, number] | null {
  const geom = feature.geometry;
  if (geom.type === "Point") {
    return geom.coordinates as [number, number];
  }
  let ring: number[][] | null = null;
  if (geom.type === "Polygon") {
    ring = geom.coordinates[0] ?? null;
  } else if (geom.type === "MultiPolygon") {
    ring = geom.coordinates[0]?.[0] ?? null;
  }
  if (!ring || ring.length === 0) return null;
  let sumLng = 0;
  let sumLat = 0;
  for (const pt of ring) {
    sumLng += pt[0];
    sumLat += pt[1];
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

/**
 * Build the marker FeatureCollection for a selected building.
 *
 * When the feature carries `_tapLng` / `_tapLat` properties (set by
 * BuildingLayer on tap), the marker is placed at the actual tap point.
 * Otherwise it falls back to the polygon centroid (e.g. search-selected).
 */
export function buildSelectedBuildingMarker(
  selectedBuilding: Feature<Geometry, GeoJsonProperties> | null,
): FeatureCollection<Point> | null {
  if (!selectedBuilding) return null;
  const tapLng = selectedBuilding.properties?._tapLng as number | undefined;
  const tapLat = selectedBuilding.properties?._tapLat as number | undefined;
  const markerCoord: [number, number] | null =
    tapLng != null && tapLat != null
      ? [tapLng, tapLat]
      : featureCenter(selectedBuilding);
  if (!markerCoord) return null;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: markerCoord },
        properties: {},
      },
    ],
  };
}
