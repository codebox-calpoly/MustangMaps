import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { Route } from "../types";

type Coordinates = [number, number];
export type SelectedBuilding = Feature<Geometry, GeoJsonProperties>;

interface MapContextValue {
  selectedBuilding: SelectedBuilding | null;
  searchQuery: string;
  userLocation: Coordinates | null;
  activeRoute: Route | null;
  selectBuilding: (building: SelectedBuilding) => void;
  clearSelection: () => void;
  setRoute: (route: Route | null) => void;
  setSearchQuery: (query: string) => void;
  setUserLocation: (location: Coordinates | null) => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);

  const selectBuilding = useCallback((building: SelectedBuilding) => {
    setSelectedBuilding(building);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const setRoute = useCallback((route: Route | null) => {
    setActiveRoute(route);
  }, []);

  const value = useMemo(
    () => ({
      selectedBuilding,
      searchQuery,
      userLocation,
      activeRoute,
      selectBuilding,
      clearSelection,
      setRoute,
      setSearchQuery,
      setUserLocation,
    }),
    [
      selectedBuilding,
      searchQuery,
      userLocation,
      activeRoute,
      selectBuilding,
      clearSelection,
      setRoute,
    ],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within MapProvider");
  }
  return context;
}
