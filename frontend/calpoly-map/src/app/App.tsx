import React, { useMemo, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapContainer } from "../components/map/MapContainer";
import { AmenitiesLayer } from "../components/map/layers/AmenitiesLayer";
import { BuildingLayer } from "../components/map/layers/BuildingLayer";
import { RoutesLayer } from "../components/map/layers/RoutesLayer";
import type {
  AmenityFilterOption,
  BuildingFilterOption,
  MapMode,
} from "../components/features/map/MapFilters";

export default function App() {
  const [mapMode, setMapMode] = useState<MapMode>("buildings");
  const [buildingFilterId, setBuildingFilterId] = useState("all");
  const [amenityTypeIds, setAmenityTypeIds] = useState<string[]>([
    "bathroom",
    "printer",
    "water_fountain",
  ]);

  const buildingOptions: BuildingFilterOption[] = useMemo(
    () => [
      { id: "all", label: "All", types: null },
      { id: "academic", label: "Academic", types: ["university", "school"] },
      { id: "dorms", label: "Dorms", types: ["dormitory"] },
      { id: "residential", label: "Residential", types: ["residential", "apartments"] },
      { id: "parking", label: "Parking", types: ["parking"] },
    ],
    [],
  );

  const amenityOptions: AmenityFilterOption[] = useMemo(
    () => [
      { id: "bathroom", label: "Bathrooms" },
      { id: "printer", label: "Printers" },
      { id: "water_fountain", label: "Water" },
    ],
    [],
  );

  const buildingTypes = useMemo(() => {
    return buildingOptions.find((option) => option.id === buildingFilterId)?.types ?? null;
  }, [buildingOptions, buildingFilterId]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <MapContainer
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          buildingFilterId={buildingFilterId}
          onBuildingFilterChange={setBuildingFilterId}
          amenityTypeIds={amenityTypeIds}
          onAmenityTypesChange={setAmenityTypeIds}
          buildingOptions={buildingOptions}
          amenityOptions={amenityOptions}
        >
          {mapMode === "buildings" && (
            <BuildingLayer buildingTypes={buildingTypes ?? undefined} />
          )}
          {mapMode === "amenities" && amenityTypeIds.length > 0 && (
            <AmenitiesLayer amenityTypes={amenityTypeIds} />
          )}
          {mapMode === "routes" && <RoutesLayer />}
        </MapContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
