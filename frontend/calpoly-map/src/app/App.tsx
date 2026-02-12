import React, { useEffect } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapProvider, useMapContext } from '../context/MapContext';
import { SavedPlacesProvider } from '../context/SavedPlacesContext';
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';
import { ClassZonesLayer } from '../components/map/layers/ClassZonesLayer';
import { AmenitiesLayer } from '../components/map/layers/AmenitiesLayer';
import { RouteLineLayer } from '../components/map/layers/RouteLineLayer';
import type { BuildingFilterOption, AmenityFilterOption } from '../components/features/map/MapFilters';
import { usePathGraph } from '../hooks/usePathGraph';
import { findPath } from '../lib/routing/pathfinder';
import { LocationProvider } from "../context/UserLocationContext";

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
  return (
    <SafeAreaProvider>
      <LocationProvider>
      <MapProvider>
        <SavedPlacesProvider>
          <SafeAreaView style={{ flex: 1 }}>
            <MapScreen
              buildingOptions={BUILDING_OPTIONS}
              amenityOptions={AMENITY_OPTIONS}
            />
          </SafeAreaView>
        </SavedPlacesProvider>
      </MapProvider>
      </LocationProvider>
    </SafeAreaProvider>
  );
}

function MapScreen({
  buildingOptions,
  amenityOptions,
}: {
  buildingOptions: BuildingFilterOption[];
  amenityOptions: AmenityFilterOption[];
}) {
  const {
    mapMode,
    buildingFilterId,
    amenityTypeIds,
    routeStart,
    routeEnd,
    routingActive,
    routeRequested,
    routeStartIsCurrentLocation,
    setActivePath,
    setRoute,
    setRouteError,
  } = useMapContext();
  const { graph, error } = usePathGraph();

  // get building types from filter
  const selectedBuildingOption = BUILDING_OPTIONS.find(opt => opt.id === buildingFilterId);
  const buildingTypes = selectedBuildingOption?.types ?? undefined;

  useEffect(() => {
    if (error) {
      setRouteError("Failed to load paths data");
    }
  }, [error, setRouteError]);

  useEffect(() => {
    if (!routingActive || !routeRequested || !routeStart || !routeEnd || !graph) {
      setActivePath(null);
      setRoute(null);
      if (routingActive && routeRequested && routeStart && routeEnd && !graph) {
        setRouteError("Loading paths data...");
      } else if (routingActive && routeRequested && (!routeStart || !routeEnd)) {
        setRouteError("Select a start and destination");
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
      setRoute(null);
      setRouteError(
        routeStartIsCurrentLocation
          ? "Current location isn't on the path network. Choose a start point."
          : "No path found between those points",
      );
      return;
    }

    setRouteError(null);
    setActivePath(result);
    setRoute({
      nodes: [],
      totalDistance: result.distance,
      coordinates: result.path,
    });
  }, [
    graph,
    routeStart,
    routeEnd,
    routingActive,
    routeRequested,
    setActivePath,
    setRoute,
    setRouteError,
  ]);

  return (
    <MapContainer
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
