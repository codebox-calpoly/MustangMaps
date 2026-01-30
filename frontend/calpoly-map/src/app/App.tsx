import React, { useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapProvider } from '../context/MapContext';
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';
import { ClassZonesLayer } from '../components/map/layers/ClassZonesLayer';
import { PathsLayer } from '../components/map/layers/PathsLayer';
import type { MapMode, BuildingFilterOption, AmenityFilterOption } from '../components/features/map/MapFilters';

const BUILDING_OPTIONS: BuildingFilterOption[] = [
  { id: "all", label: "All", types: null },
  { id: "academic", label: "Academic", types: ["academic"] },
  { id: "residential", label: "Residential", types: ["residential"] },
  { id: "dining", label: "Dining", types: ["dining"] },
];

const AMENITY_OPTIONS: AmenityFilterOption[] = [
  { id: "restroom", label: "Restrooms" },
  { id: "parking", label: "Parking" },
  { id: "water", label: "Water" },
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
          <MapContainer
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            buildingFilterId={buildingFilterId}
            onBuildingFilterChange={setBuildingFilterId}
            amenityTypeIds={amenityTypeIds}
            onAmenityTypesChange={setAmenityTypeIds}
            buildingOptions={BUILDING_OPTIONS}
            amenityOptions={AMENITY_OPTIONS}
          >
            <BuildingLayer buildingTypes={buildingTypes} />
            <ClassZonesLayer />
            <PathsLayer />
          </MapContainer>
        </SafeAreaView>
      </MapProvider>
    </SafeAreaProvider>
  );
}
