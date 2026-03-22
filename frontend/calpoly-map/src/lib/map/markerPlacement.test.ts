import test from "node:test";
import assert from "node:assert/strict";
import { featureCenter, buildSelectedBuildingMarker } from "./markerPlacement";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";

// ── featureCenter ──────────────────────────────────────────────────────

test("featureCenter returns coordinates for a Point feature", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-120.66, 35.3] },
    properties: {},
  };
  assert.deepEqual(featureCenter(f), [-120.66, 35.3]);
});

test("featureCenter returns centroid for a Polygon feature", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    },
    properties: {},
  };
  const center = featureCenter(f);
  assert.ok(center);
  // Average of 5 ring vertices (closed ring, first == last)
  assert.ok(Math.abs(center[0] - 1.6) < 0.001);
  assert.ok(Math.abs(center[1] - 1.6) < 0.001);
});

test("featureCenter returns centroid for a MultiPolygon feature", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [10, 10],
            [20, 10],
            [20, 20],
            [10, 20],
            [10, 10],
          ],
        ],
      ],
    },
    properties: {},
  };
  const center = featureCenter(f);
  assert.ok(center);
  assert.ok(Math.abs(center[0] - 14) < 0.001);
  assert.ok(Math.abs(center[1] - 14) < 0.001);
});

test("featureCenter returns null for a LineString feature", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
    properties: {},
  };
  assert.equal(featureCenter(f), null);
});

// ── buildSelectedBuildingMarker ────────────────────────────────────────

test("returns null when selectedBuilding is null", () => {
  assert.equal(buildSelectedBuildingMarker(null), null);
});

test("uses tap coordinates when _tapLng/_tapLat are present", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    },
    properties: { _tapLng: 2.5, _tapLat: 1.5, building: "yes" },
  };
  const result = buildSelectedBuildingMarker(f);
  assert.ok(result);
  assert.equal(result.features.length, 1);
  const coords = result.features[0].geometry.coordinates;
  assert.deepEqual(coords, [2.5, 1.5]);
});

test("falls back to centroid when tap coordinates are absent", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    },
    properties: { building: "yes" },
  };
  const result = buildSelectedBuildingMarker(f);
  assert.ok(result);
  const coords = result.features[0].geometry.coordinates;
  // Should be centroid, not a specific tap point
  assert.ok(Math.abs(coords[0] - 1.6) < 0.001);
  assert.ok(Math.abs(coords[1] - 1.6) < 0.001);
});

test("marker is exactly at tap point for L-shaped building", () => {
  // L-shaped polygon whose centroid is far from the tap point
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 2],
          [2, 2],
          [2, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    },
    properties: { _tapLng: 8.0, _tapLat: 1.0, building: "yes" },
  };
  const result = buildSelectedBuildingMarker(f);
  assert.ok(result);
  const coords = result.features[0].geometry.coordinates;
  // Must be exactly the tap point, not the centroid
  assert.deepEqual(coords, [8.0, 1.0]);

  // Verify the centroid would have been different
  const centroid = featureCenter(f);
  assert.ok(centroid);
  assert.notDeepEqual(centroid, [8.0, 1.0]);
});

test("tap coordinates at (0, 0) are still used (not treated as falsy)", () => {
  const f: Feature<Geometry, GeoJsonProperties> = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
          [-1, -1],
        ],
      ],
    },
    properties: { _tapLng: 0, _tapLat: 0, building: "yes" },
  };
  const result = buildSelectedBuildingMarker(f);
  assert.ok(result);
  assert.deepEqual(result.features[0].geometry.coordinates, [0, 0]);
});
