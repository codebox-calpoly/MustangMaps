import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { Route } from "../types/index";
import {
  type PathfinderResult,
} from "../lib/routing/pathfinder";

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
  // Populated by BuildingLayer once it loads the geojson. Used by
  // MapContainer to point-in-polygon-test shared pins against buildings,
  // so a pin shared from inside a building routes to the building (with
  // a proper name) instead of to bare coordinates.
  buildingsData: FeatureCollection | null;
  activeRoute: Route | null;
  routeDestination: SelectedBuilding | null;
  routeStart: Coordinates | null;
  routeEnd: Coordinates | null;
  activePath: PathfinderResult | null;
  routeError: string | null;
  routingActive: boolean;
  routeRequested: boolean;
  routeStartIsCurrentLocation: boolean;
  routeAccessibleOnly: boolean;
  trackingMode: boolean;
  navigationMode: boolean;
  selectBuilding: (building: SelectedBuilding) => void;
  clearSelection: () => void;
  selectAmenity: (amenity: Feature<Geometry, GeoJsonProperties>, levels: number[]) => void;
  clearAmenitySelection: () => void;
  setRoute: (route: Route | null) => void;
  setRouteDestination: (building: SelectedBuilding | null) => void;
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
  setRouteAccessibleOnly: (value: boolean) => void;
  setMapDataStatus: (
    key: string,
    status: { loading?: boolean; error?: string | null },
  ) => void;
  setBuildingsData: (data: FeatureCollection | null) => void;
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
  const [buildingsData, setBuildingsDataState] =
    useState<FeatureCollection | null>(null);

  const setBuildingsData = useCallback((data: FeatureCollection | null) => {
    setBuildingsDataState(data);
  }, []);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeDestination, setRouteDestination] =
    useState<SelectedBuilding | null>(null);
  const [routeStart, setRouteStart] = useState<Coordinates | null>(null);
  const [routeEnd, setRouteEnd] = useState<Coordinates | null>(null);
  const [activePath, setActivePath] = useState<PathfinderResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routingActive, setRoutingActive] = useState(false);
  const [routeRequested, setRouteRequested] = useState(false);
  const [routeStartIsCurrentLocation, setRouteStartIsCurrentLocation] =
    useState(false);
  const [routeAccessibleOnly, setRouteAccessibleOnly] = useState(false);

  // Tracking mode: active when a route has been computed and routing is on
  const trackingMode = routingActive && activePath !== null;
  const navigationMode = trackingMode;

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
    setRouteDestination(null);
    setRoutingActive(false);
    setRouteAccessibleOnly(false);
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
      buildingsData,
      activeRoute,
      routeDestination,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      routingActive,
      routeRequested,
      routeStartIsCurrentLocation,
      routeAccessibleOnly,
      trackingMode,
      navigationMode,
      selectBuilding,
      clearSelection,
      selectAmenity,
      clearAmenitySelection,
      setRoute,
      setRouteDestination,
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
      setRouteAccessibleOnly,
      setMapDataStatus,
      setBuildingsData,
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
      buildingsData,
      activeRoute,
      routeDestination,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      routingActive,
      routeRequested,
      routeStartIsCurrentLocation,
      routeAccessibleOnly,
      trackingMode,
      navigationMode,
      selectBuilding,
      clearSelection,
      selectAmenity,
      clearAmenitySelection,
      setRoute,
      setRouteDestination,
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
      setRouteAccessibleOnly,
      setMapDataStatus,
      setBuildingsData,
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
