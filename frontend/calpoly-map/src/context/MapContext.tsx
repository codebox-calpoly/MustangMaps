import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { Route } from "../types/index";
import type { PathfinderResult } from "../lib/routing/pathfinder";

type Coordinates = [number, number];
export type SelectedBuilding = Feature<Geometry, GeoJsonProperties>;

interface MapContextValue {
  mapMode: "buildings" | "amenities";
  mapStyle: "light" | "dark";
  buildingTypeIds: string[];
  amenityTypeIds: string[];
  selectedBuilding: SelectedBuilding | null;
  selectedAmenity: Feature<Geometry, GeoJsonProperties> | null;
  amenityLevels: number[];
  searchQuery: string;
  userLocation: Coordinates | null;
  locationAccuracy: number | null;
  mapDataLoading: Record<string, boolean>;
  mapDataErrors: Record<string, string | null>;
  mapDataRetryToken: number;
  activeRoute: Route | null;
  routeStart: Coordinates | null;
  routeEnd: Coordinates | null;
  activePath: PathfinderResult | null;
  routeError: string | null;
  routingActive: boolean;
  routeRequested: boolean;
  routeStartIsCurrentLocation: boolean;
  selectBuilding: (building: SelectedBuilding) => void;
  clearSelection: () => void;
  selectAmenity: (amenity: Feature<Geometry, GeoJsonProperties>, levels: number[]) => void;
  clearAmenitySelection: () => void;
  setRoute: (route: Route | null) => void;
  setSearchQuery: (query: string) => void;
  setUserLocation: (location: Coordinates | null) => void;
  setLocationAccuracy: (accuracy: number | null) => void;
  setRouteStart: (location: Coordinates | null) => void;
  setRouteEnd: (location: Coordinates | null) => void;
  setActivePath: (route: PathfinderResult | null) => void;
  setRouteError: (message: string | null) => void;
  setRoutingActive: (active: boolean) => void;
  setMapMode: (mode: "buildings" | "amenities") => void;
  setMapStyle: (style: "light" | "dark") => void;
  setBuildingTypeIds: (ids: string[]) => void;
  setAmenityTypeIds: (ids: string[]) => void;
  setRouteRequested: (requested: boolean) => void;
  setRouteStartIsCurrentLocation: (value: boolean) => void;
  setMapDataStatus: (
    key: string,
    status: { loading?: boolean; error?: string | null },
  ) => void;
  retryMapData: () => void;
  clearRoute: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  // filter state shared across the app
  const [mapMode, setMapMode] =
    useState<"buildings" | "amenities">("buildings");
  const [mapStyle, setMapStyle] = useState<"light" | "dark">("light");
  const [buildingTypeIds, setBuildingTypeIds] = useState<string[]>([]);
  const [amenityTypeIds, setAmenityTypeIds] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [selectedAmenity, setSelectedAmenity] =
    useState<Feature<Geometry, GeoJsonProperties> | null>(null);
  const [amenityLevels, setAmenityLevels] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [mapDataLoading, setMapDataLoading] = useState<Record<string, boolean>>({});
  const [mapDataErrors, setMapDataErrors] = useState<Record<string, string | null>>({});
  const [mapDataRetryToken, setMapDataRetryToken] = useState(0);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeStart, setRouteStart] = useState<Coordinates | null>(null);
  const [routeEnd, setRouteEnd] = useState<Coordinates | null>(null);
  const [activePath, setActivePath] = useState<PathfinderResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routingActive, setRoutingActive] = useState(false);
  const [routeRequested, setRouteRequested] = useState(false);
  const [routeStartIsCurrentLocation, setRouteStartIsCurrentLocation] =
    useState(false);

  // Keep routeStart in sync with live location when starting from current position.
  // Only use locations with reasonable accuracy (≤20m) so the route doesn't start
  // from a stale or wildly inaccurate GPS position (common on first app load).
  useEffect(() => {
    if (routeStartIsCurrentLocation && userLocation) {
      const accuracyOk = locationAccuracy == null || locationAccuracy <= 20;
      if (accuracyOk) {
        setRouteStart(userLocation);
      }
    }
  }, [routeStartIsCurrentLocation, userLocation, locationAccuracy]);

  const selectBuilding = useCallback((building: SelectedBuilding) => {
    setSelectedBuilding(building);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const selectAmenity = useCallback(
    (amenity: Feature<Geometry, GeoJsonProperties>, levels: number[]) => {
      setSelectedAmenity(amenity);
      setAmenityLevels(levels);
    },
    [],
  );

  const clearAmenitySelection = useCallback(() => {
    setSelectedAmenity(null);
    setAmenityLevels([]);
  }, []);

  const setRoute = useCallback((route: Route | null) => {
    setActiveRoute(route);
  }, []);

  const setMapDataStatus = useCallback(
    (key: string, status: { loading?: boolean; error?: string | null }) => {
      if (status.loading !== undefined) {
        const loading = status.loading;
        setMapDataLoading((prev) => ({ ...prev, [key]: loading }));
      }
      if (status.error !== undefined) {
        const error = status.error;
        setMapDataErrors((prev) => ({ ...prev, [key]: error }));
      }
    },
    [],
  );

  const retryMapData = useCallback(() => {
    setMapDataRetryToken((prev) => prev + 1);
  }, []);

  const clearRoute = useCallback(() => {
    setRouteStart(null);
    setRouteEnd(null);
    setActivePath(null);
    setRouteError(null);
    setRouteRequested(false);
    setRouteStartIsCurrentLocation(false);
  }, []);

  const value = useMemo(
    () => ({
      mapMode,
      mapStyle,
      buildingTypeIds,
      amenityTypeIds,
      selectedBuilding,
      selectedAmenity,
      amenityLevels,
      searchQuery,
      userLocation,
      locationAccuracy,
      mapDataLoading,
      mapDataErrors,
      mapDataRetryToken,
      activeRoute,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      routingActive,
      routeRequested,
      routeStartIsCurrentLocation,
      selectBuilding,
      clearSelection,
      selectAmenity,
      clearAmenitySelection,
      setRoute,
      setSearchQuery,
      setUserLocation,
      setLocationAccuracy,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
      setRoutingActive,
      setMapMode,
      setMapStyle,
      setBuildingTypeIds,
      setAmenityTypeIds,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      setMapDataStatus,
      retryMapData,
      clearRoute,
    }),
    [
      mapMode,
      mapStyle,
      buildingTypeIds,
      amenityTypeIds,
      selectedBuilding,
      selectedAmenity,
      amenityLevels,
      searchQuery,
      userLocation,
      locationAccuracy,
      mapDataLoading,
      mapDataErrors,
      mapDataRetryToken,
      activeRoute,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      routingActive,
      routeRequested,
      routeStartIsCurrentLocation,
      selectBuilding,
      clearSelection,
      selectAmenity,
      clearAmenitySelection,
      setRoute,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
      setRoutingActive,
      setMapMode,
      setMapStyle,
      setBuildingTypeIds,
      setAmenityTypeIds,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      setMapDataStatus,
      retryMapData,
      clearRoute,
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
