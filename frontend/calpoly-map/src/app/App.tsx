import React, { useEffect, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapProvider, useMapContext } from '../context/MapContext';
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';
import { ClassZonesLayer } from '../components/map/layers/ClassZonesLayer';
import { AmenitiesLayer } from '../components/map/layers/AmenitiesLayer';
import { RouteLineLayer } from '../components/map/layers/RouteLineLayer';
import type { MapMode, BuildingFilterOption, AmenityFilterOption } from '../components/features/map/MapFilters';
import { usePathGraph } from '../hooks/usePathGraph';
import { findPath } from '../lib/routing/pathfinder';

const BUILDING_OPTIONS: BuildingFilterOption[] = [
  { id: "all", label: "All", types: null },
  { id: "academic", label: "Academic", types: ["academic"] },
  { id: "residential", label: "Residential", types: ["residential"] },
  { id: "dining", label: "Dining", types: ["dining"] },
];

const AMENITY_OPTIONS: AmenityFilterOption[] = [
  { id: "bathroom", label: "Bathrooms" },
  { id: "water_fountain", label: "Water Fountains" },
  { id: "printer", label: "Printers" },
];

export default function App() {
  const [mapMode, setMapMode] = useState<MapMode>("buildings");
  const [buildingFilterId, setBuildingFilterId] = useState("all");
  const [amenityTypeIds, setAmenityTypeIds] = useState<string[]>([]);

  // Get the building types for the selected filter
  const selectedBuildingOption = BUILDING_OPTIONS.find(opt => opt.id === buildingFilterId);
  const buildingTypes = selectedBuildingOption?.types ?? undefined;

  return (
    <SafeAreaProvider>
      <MapProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <MapScreen
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            buildingFilterId={buildingFilterId}
            onBuildingFilterChange={setBuildingFilterId}
            amenityTypeIds={amenityTypeIds}
            onAmenityTypesChange={setAmenityTypeIds}
            buildingOptions={BUILDING_OPTIONS}
            amenityOptions={AMENITY_OPTIONS}
            buildingTypes={buildingTypes}
          />
        </SafeAreaView>
      </MapProvider>
    </SafeAreaProvider>
  );
}

function MapScreen({
  mapMode,
  onMapModeChange,
  buildingFilterId,
  onBuildingFilterChange,
  amenityTypeIds,
  onAmenityTypesChange,
  buildingOptions,
  amenityOptions,
  buildingTypes,
}: {
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  buildingFilterId: string;
  onBuildingFilterChange: (id: string) => void;
  amenityTypeIds: string[];
  onAmenityTypesChange: (ids: string[]) => void;
  buildingOptions: BuildingFilterOption[];
  amenityOptions: AmenityFilterOption[];
  buildingTypes?: string[];
}) {
  const {
    routeStart,
    routeEnd,
    routingActive,
    routeRequested,
    routeStartIsCurrentLocation,
    setActivePath,
    setRouteError,
  } = useMapContext();
  const { graph, error } = usePathGraph();

  useEffect(() => {
    if (error) {
      setRouteError("Failed to load paths data");
    }
  }, [error, setRouteError]);

  useEffect(() => {
    if (!routingActive || !routeRequested || !routeStart || !routeEnd || !graph) {
      setActivePath(null);
      if (routingActive && routeRequested && routeStart && routeEnd && !graph) {
        setRouteError("Loading paths data...");
      } else {
        setRouteError(null);
      }
      return;
    }

    let result = findPath(graph, routeStart, routeEnd);
    if (!result) {
      result = findPath(graph, routeStart, routeEnd, {
        snapRadiusMeters: 150,
      });
    }
    if (!result && routeStartIsCurrentLocation) {
      result = findPath(graph, routeStart, routeEnd, {
        snapRadiusMeters: 300,
      });
    }
    if (!result) {
      setActivePath(null);
      setRouteError(
        routeStartIsCurrentLocation
          ? "Current location isn't on the path network. Choose a start point."
          : "No path found between those points",
      );
      return;
    }

    setRouteError(null);
    setActivePath(result);
  }, [
    graph,
    routeStart,
    routeEnd,
    routingActive,
    routeRequested,
    setActivePath,
    setRouteError,
  ]);

  return (
    <MapContainer
      mapMode={mapMode}
      onMapModeChange={onMapModeChange}
      buildingFilterId={buildingFilterId}
      onBuildingFilterChange={onBuildingFilterChange}
      amenityTypeIds={amenityTypeIds}
      onAmenityTypesChange={onAmenityTypesChange}
      buildingOptions={buildingOptions}
      amenityOptions={amenityOptions}
    >
      <BuildingLayer buildingTypes={buildingTypes} />
      <ClassZonesLayer />
      {/* Only render amenities when in amenities mode or when filters are selected */}
      {(mapMode === "amenities" || amenityTypeIds.length > 0) && (
        <AmenitiesLayer amenityTypes={amenityTypeIds} />
      )}
      <RouteLineLayer />
    </MapContainer>
  );
}
