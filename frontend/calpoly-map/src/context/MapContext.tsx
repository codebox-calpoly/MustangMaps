import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { Route } from "../types/index";
import {
  findPath,
  type PathfinderResult,
  type PathGraph,
  type RouteSegment,
} from "../lib/routing/pathfinder";
import {
  buildDirectionsFromPath,
  type DirectionStep,
} from "../lib/routing/directions";

type Coordinates = [number, number];
export type SelectedBuilding = Feature<Geometry, GeoJsonProperties>;

const STEP_REACHED_THRESHOLD_METERS = 12;
const ARRIVAL_PROXIMITY_METERS = 35;
const ARRIVAL_EDGE_PROXIMITY_METERS = 20;
const ARRIVAL_PATH_END_METERS = 25;
const ARRIVAL_CENTROID_BUFFER_METERS = 15;
const ARRIVAL_REMAINING_ROUTE_METERS = 30;
const STEP_PROGRESS_SNAP_METERS = 60;
const DEVIATION_THRESHOLD_METERS = 15;
const REROUTE_COOLDOWN_MS = 3000;
const REROUTE_GRACE_PERIOD_MS = 3000;
const REROUTE_MIN_MOVEMENT_METERS = 10;
const HEADING_MIN_MOVE_METERS = 5;
const HEADING_PROJECT_METERS = 100;

function distanceBetweenCoordinatesMeters(
  from: Coordinates,
  to: Coordinates,
) {
  const toRadians = Math.PI / 180;
  const lat1 = from[1] * toRadians;
  const lat2 = to[1] * toRadians;
  const latDelta = (to[1] - from[1]) * toRadians;
  const lonDelta = (to[0] - from[0]) * toRadians;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6_371_000 * c;
}

/** Shortest distance (meters) from a point to any segment in a path. */
function minDistanceToPath(
  point: Coordinates,
  path: [number, number][],
): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return distanceBetweenCoordinatesMeters(point, path[0]);

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const dist = pointToSegmentDistance(point, path[i], path[i + 1]);
    if (dist < min) min = dist;
  }
  return min;
}

/**
 * Approximate distance from a point to a line segment using flat‑Earth
 * projection (accurate enough at campus scale).
 */
function pointToSegmentDistance(
  point: Coordinates,
  segA: [number, number],
  segB: [number, number],
): number {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((segA[1] + segB[1]) / 2) * toRad);

  // Project to flat meters (lon=x, lat=y)
  const px = (point[0] - segA[0]) * cosLat * 111_320;
  const py = (point[1] - segA[1]) * 111_320;
  const ax = 0;
  const ay = 0;
  const bx = (segB[0] - segA[0]) * cosLat * 111_320;
  const by = (segB[1] - segA[1]) * 111_320;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  }

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

/** Ray-casting point-in-polygon test (works with GeoJSON [lon,lat] rings). */
function isPointInPolygon(
  point: Coordinates,
  ring: number[][],
): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Minimum distance (meters) from a point to any edge of a polygon ring.
 * Uses flat-Earth projection (accurate at campus scale).
 */
function minDistanceToPolygonEdge(
  point: Coordinates,
  ring: number[][],
): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const dist = pointToSegmentDistance(
      point,
      ring[j] as [number, number],
      ring[i] as [number, number],
    );
    if (dist < min) min = dist;
  }
  return min;
}

/**
 * Maximum distance (meters) from a centroid to any vertex of a polygon ring.
 * This gives the building's "bounding radius" so arrival detection scales
 * with building size.
 */
function polygonBoundingRadius(
  centroid: Coordinates,
  ring: number[][],
): number {
  let max = 0;
  for (const vertex of ring) {
    const dist = distanceBetweenCoordinatesMeters(
      centroid,
      vertex as [number, number],
    );
    if (dist > max) max = dist;
  }
  return max;
}

/** Flat-Earth bearing (degrees, 0=north, clockwise) between two coordinates. */
function computeBearing(from: Coordinates, to: Coordinates): number {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((from[1] + to[1]) / 2) * toRad);
  const dLon = (to[0] - from[0]) * cosLat;
  const dLat = to[1] - from[1];
  const bearing = Math.atan2(dLon, dLat) * (180 / Math.PI);
  return ((bearing % 360) + 360) % 360;
}

/** Project a point onto a segment, returning fractional t and flat-Earth distSq. */
function projectOntoPathSeg(
  point: Coordinates,
  segA: [number, number],
  segB: [number, number],
): { t: number; distSq: number } {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((segA[1] + segB[1]) / 2) * toRad);
  const px = (point[0] - segA[0]) * cosLat * 111_320;
  const py = (point[1] - segA[1]) * 111_320;
  const bx = (segB[0] - segA[0]) * cosLat * 111_320;
  const by = (segB[1] - segA[1]) * 111_320;
  const lenSq = bx * bx + by * by;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;
  const dx = px - t * bx;
  const dy = py - t * by;
  return { t, distSq: dx * dx + dy * dy };
}

/**
 * Trim a PathfinderResult so it starts from the user's current position
 * instead of from a graph snap node.  This prevents false turn instructions
 * at the start of a rerouted path where the snap node is offset from the
 * user, creating a phantom bearing change.
 */
function trimPathFromUser(
  userPos: Coordinates,
  result: PathfinderResult,
): PathfinderResult {
  const path = result.path;
  if (path.length < 2) return result;

  let bestSegIdx = 0;
  let bestDistSq = Number.POSITIVE_INFINITY;
  let bestT = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const { t, distSq } = projectOntoPathSeg(userPos, path[i], path[i + 1]);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSegIdx = i;
      bestT = t;
    }
  }

  const segA = path[bestSegIdx];
  const segB = path[bestSegIdx + 1];
  const projected: [number, number] = [
    segA[0] + bestT * (segB[0] - segA[0]),
    segA[1] + bestT * (segB[1] - segA[1]),
  ];

  const trimmedPath: [number, number][] = [projected, ...path.slice(bestSegIdx + 1)];

  const segments: RouteSegment[] = [];
  for (let i = 0; i < trimmedPath.length - 1; i++) {
    segments.push({
      from: trimmedPath[i],
      to: trimmedPath[i + 1],
      distance: distanceBetweenCoordinatesMeters(trimmedPath[i], trimmedPath[i + 1]),
      bearing: computeBearing(trimmedPath[i], trimmedPath[i + 1]),
    });
  }

  return {
    ...result,
    path: trimmedPath,
    segments,
    distance: segments.reduce((sum, seg) => sum + seg.distance, 0),
  };
}

/** Project a coordinate forward by `distanceMeters` along `bearingDeg`. */
function projectCoordinate(
  from: Coordinates,
  bearingDeg: number,
  distanceMeters: number,
): Coordinates {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(from[1] * toRad);
  const dLat = (distanceMeters * Math.cos(bearingDeg * toRad)) / 111_320;
  const dLon = (distanceMeters * Math.sin(bearingDeg * toRad)) / (111_320 * cosLat);
  return [from[0] + dLon, from[1] + dLat];
}

interface MapContextValue {
  mapMode: "buildings" | "amenities" | "routing";
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
  routeDestination: SelectedBuilding | null;
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
  setRouteDestination: (building: SelectedBuilding | null) => void;
  setSearchQuery: (query: string) => void;
  setUserLocation: (location: Coordinates | null) => void;
  setLocationAccuracy: (accuracy: number | null) => void;
  setRouteStart: (location: Coordinates | null) => void;
  setRouteEnd: (location: Coordinates | null) => void;
  setActivePath: (route: PathfinderResult | null) => void;
  setRouteError: (message: string | null) => void;
  setRoutingActive: (active: boolean) => void;
  setMapMode: (mode: "buildings" | "amenities" | "routing") => void;
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
  navigationMode: boolean;
  navSteps: DirectionStep[];
  activeStepIndex: number;
  startNavigation: () => void;
  exitNavigation: () => void;
  graph: PathGraph | null;
  setGraph: (graph: PathGraph | null) => void;
  isRerouting: boolean;
  hasArrived: boolean;
  dismissArrival: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  // filter state shared across the app
  const [mapMode, setMapMode] =
    useState<"buildings" | "amenities" | "routing">("buildings");
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

  // path graph (set from App.tsx after loading)
  const [graph, setGraph] = useState<PathGraph | null>(null);

  // navigation mode state
  const [navigationMode, setNavigationMode] = useState(false);
  const [navSteps, setNavSteps] = useState<DirectionStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const lastRerouteTimeRef = useRef(0);
  const navStartTimeRef = useRef(0);
  const rerouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationHistoryRef = useRef<Coordinates[]>([]);
  const consecutiveDeviationsRef = useRef(0);
  const userLocationRef = useRef<Coordinates | null>(null);

  // Keep a ref of the latest userLocation so startNavigation can read it
  // without adding userLocation to its dependency array (which would cause
  // the entire context value to be recreated on every GPS update).
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Track distinct GPS positions for heading computation during rerouting
  useEffect(() => {
    if (!userLocation) return;
    const history = locationHistoryRef.current;
    const last = history[history.length - 1];
    if (!last || distanceBetweenCoordinatesMeters(last, userLocation) > 3) {
      history.push(userLocation);
      if (history.length > 10) history.shift();
    }
  }, [userLocation]);

  // Keep routeStart in sync with live location when starting from current position.
  // Only use locations with reasonable accuracy (≤20m) so the route doesn't start
  // from a stale or wildly inaccurate GPS position (common on first app load).
  useEffect(() => {
    if (routeStartIsCurrentLocation && userLocation && !navigationMode) {
      const accuracyOk = locationAccuracy == null || locationAccuracy <= 20;
      if (accuracyOk) {
        setRouteStart(userLocation);
      }
    }
  }, [routeStartIsCurrentLocation, userLocation, locationAccuracy, navigationMode]);

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

  const startNavigation = useCallback(() => {
    if (!activePath) return;

    // Trim the path from the user's current position so the first direction
    // reflects reality, not the pathfinder's snap-node offset.  This is the
    // same fix applied during rerouting (trimPathFromUser).
    const currentPos = userLocationRef.current;
    const pathToUse = currentPos
      ? trimPathFromUser(currentPos, activePath)
      : activePath;

    setActivePath(pathToUse);
    const steps = buildDirectionsFromPath(pathToUse);

    setNavSteps(steps);
    setActiveStepIndex(0);
    setNavigationMode(true);
    setIsRerouting(false);
    if (rerouteTimerRef.current) {
      clearTimeout(rerouteTimerRef.current);
      rerouteTimerRef.current = null;
    }
    navStartTimeRef.current = Date.now();
    locationHistoryRef.current = [];
    consecutiveDeviationsRef.current = 0;
  }, [activePath]);

  const exitNavigation = useCallback(() => {
    setNavigationMode(false);
    setNavSteps([]);
    setActiveStepIndex(0);
    setIsRerouting(false);
    if (rerouteTimerRef.current) {
      clearTimeout(rerouteTimerRef.current);
      rerouteTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!navigationMode || navSteps.length === 0 || !userLocation) {
      return;
    }

    const finalStepIndex = navSteps.length - 1;
    if (activeStepIndex >= finalStepIndex) {
      return;
    }

    // Brief grace period after navigation starts or after a reroute.
    // GPS offset can place the user within STEP_REACHED_THRESHOLD of
    // the first step's endpoint on the very first update, causing the
    // new instructions to flash for one frame then immediately advance.
    // Freezing for 2 seconds lets the user read the initial instruction.
    if (Date.now() - navStartTimeRef.current < 2000) {
      return;
    }

    let nextStepIndex = activeStepIndex;

    // Primary check: advance past steps whose endpoint the user is close to.
    while (nextStepIndex < finalStepIndex) {
      const step = navSteps[nextStepIndex];
      const distanceToStepEnd = distanceBetweenCoordinatesMeters(
        userLocation,
        step.to,
      );
      if (distanceToStepEnd > STEP_REACHED_THRESHOLD_METERS) {
        break;
      }
      nextStepIndex += 1;
    }

    // Path-projection check: if the user's closest path segment is beyond
    // the current step's endpoint, they've walked past it even if their
    // straight-line distance to the exact coordinate is > threshold (GPS
    // offset).  This keeps step advancement in sync with what the UI shows.
    if (nextStepIndex === activeStepIndex && activePath) {
      const path = activePath.path as [number, number][];
      const stepTo = navSteps[activeStepIndex].to;

      // Find the path index of the current step's endpoint
      let stepToPathIdx = -1;
      for (let i = 0; i < path.length; i++) {
        if (path[i][0] === stepTo[0] && path[i][1] === stepTo[1]) {
          stepToPathIdx = i;
          break;
        }
      }

      if (stepToPathIdx >= 0 && stepToPathIdx < path.length - 1) {
        // Only use path projection when the user is reasonably close to
        // the step endpoint.  Without this guard, GPS offset on a short
        // first segment can make the user appear closer to a later
        // segment, skipping the "head" step when the turn is 200+ m away.
        const distToStepEnd = distanceBetweenCoordinatesMeters(
          userLocation,
          stepTo,
        );
        if (distToStepEnd <= STEP_PROGRESS_SNAP_METERS) {
          // Find which path segment the user is closest to
          let bestSegIdx = 0;
          let bestDistSq = Number.POSITIVE_INFINITY;
          for (let i = 0; i < path.length - 1; i++) {
            const { distSq } = projectOntoPathSeg(userLocation, path[i], path[i + 1]);
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestSegIdx = i;
            }
          }

          // If the user's closest segment starts at or after the step's
          // endpoint, they've walked past it — advance.
          if (bestSegIdx >= stepToPathIdx) {
            nextStepIndex = activeStepIndex + 1;
            // Continue advancing past any further steps whose endpoint the
            // user has also passed.
            while (nextStepIndex < finalStepIndex) {
              const dist = distanceBetweenCoordinatesMeters(
                userLocation,
                navSteps[nextStepIndex].to,
              );
              if (dist > STEP_REACHED_THRESHOLD_METERS) break;
              nextStepIndex += 1;
            }
          }
        }
      }
    }

    // Snap progression fallback: when close to the current step's endpoint,
    // check if a future step's endpoint is even closer (handles GPS drift
    // past step transitions).
    if (nextStepIndex === activeStepIndex) {
      const distToCurrentEnd = distanceBetweenCoordinatesMeters(
        userLocation,
        navSteps[activeStepIndex].to,
      );
      if (distToCurrentEnd <= STEP_PROGRESS_SNAP_METERS) {
        let nearestForwardIndex = activeStepIndex;
        let nearestForwardDistance = distToCurrentEnd;

        for (let index = activeStepIndex + 1; index <= finalStepIndex; index += 1) {
          const distanceToStepEnd = distanceBetweenCoordinatesMeters(
            userLocation,
            navSteps[index].to,
          );
          if (distanceToStepEnd < nearestForwardDistance) {
            nearestForwardDistance = distanceToStepEnd;
            nearestForwardIndex = index;
          }
        }

        if (nearestForwardIndex > activeStepIndex) {
          nextStepIndex = nearestForwardIndex;
        }
      }
    }

    if (nextStepIndex !== activeStepIndex) {
      setActiveStepIndex(nextStepIndex);
    }
  }, [activePath, activeStepIndex, navSteps, navigationMode, userLocation]);

  // Deviation-based rerouting during active navigation
  useEffect(() => {
    if (!navigationMode || !activePath || !userLocation || !graph || !routeEnd) {
      return;
    }

    // Don't reroute if user has reached the arrive step
    const finalStepIdx = navSteps.length - 1;
    if (finalStepIdx >= 0 && activeStepIndex >= finalStepIdx) {
      return;
    }

    // Don't reroute if user is at/near the destination building — let the
    // arrival detection handle it instead of creating route noise.
    const hasDestPoly =
      routeDestination?.geometry?.type === "Polygon" &&
      Array.isArray(routeDestination.geometry.coordinates?.[0]);
    const destRing = hasDestPoly
      ? (routeDestination!.geometry as { coordinates: number[][][] }).coordinates[0]
      : null;

    if (destRing && isPointInPolygon(userLocation, destRing)) {
      return;
    }
    if (destRing) {
      const edgeDist = minDistanceToPolygonEdge(userLocation, destRing);
      if (edgeDist <= ARRIVAL_EDGE_PROXIMITY_METERS) return;
    }
    const distToDestination = distanceBetweenCoordinatesMeters(
      userLocation,
      routeEnd,
    );
    if (destRing) {
      const boundingRadius = polygonBoundingRadius(routeEnd, destRing);
      const dynamicThreshold = Math.max(boundingRadius, ARRIVAL_PROXIMITY_METERS) + ARRIVAL_CENTROID_BUFFER_METERS;
      if (distToDestination <= dynamicThreshold) return;
    } else if (distToDestination <= ARRIVAL_PROXIMITY_METERS) {
      return;
    }

    // Don't reroute during the grace period after navigation starts or
    // after a reroute — GPS needs time to settle and the new route may
    // not yet align with the noisy initial fix.
    const now = Date.now();
    if (now - navStartTimeRef.current < REROUTE_GRACE_PERIOD_MS) {
      return;
    }

    // Only reroute if the user has actually moved.  GPS jitter while
    // stationary can easily exceed the deviation threshold.
    const locHistory = locationHistoryRef.current;
    if (locHistory.length >= 2) {
      const totalMovement = distanceBetweenCoordinatesMeters(
        locHistory[0],
        locHistory[locHistory.length - 1],
      );
      if (totalMovement < REROUTE_MIN_MOVEMENT_METERS) {
        return;
      }
    }

    const deviation = minDistanceToPath(
      userLocation,
      activePath.path as [number, number][],
    );
    if (deviation <= DEVIATION_THRESHOLD_METERS) {
      consecutiveDeviationsRef.current = 0;
      return;
    }

    // Require multiple consecutive off-path readings before rerouting.
    // A single GPS spike or brief drift shouldn't trigger a reroute —
    // only a sustained deviation (user took a wrong turn) should.
    consecutiveDeviationsRef.current += 1;
    if (consecutiveDeviationsRef.current < 2) {
      return;
    }
    consecutiveDeviationsRef.current = 0;

    if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) {
      return;
    }
    lastRerouteTimeRef.current = now;

    setIsRerouting(true);
    // Clear any previous dismiss timer
    if (rerouteTimerRef.current) clearTimeout(rerouteTimerRef.current);

    // Try heading-aware routing first: project the user forward in their
    // direction of travel so the pathfinder snaps to a node ahead rather
    // than behind, avoiding "turn around" instructions.
    let result: PathfinderResult | null = null;
    const history = locationHistoryRef.current;
    if (history.length >= 2) {
      const oldest = history[0];
      const moveDist = distanceBetweenCoordinatesMeters(oldest, userLocation);
      if (moveDist > HEADING_MIN_MOVE_METERS) {
        const heading = computeBearing(oldest, userLocation);
        const projected = projectCoordinate(userLocation, heading, HEADING_PROJECT_METERS);
        result = findPath(graph, projected, routeEnd);
        if (!result) {
          result = findPath(graph, projected, routeEnd, { snapRadiusMeters: 100 });
        }
      }
    }

    // Fall back to routing from current position
    if (!result) {
      result = findPath(graph, userLocation, routeEnd);
    }
    if (!result) {
      result = findPath(graph, userLocation, routeEnd, {
        snapRadiusMeters: 150,
      });
    }
    if (!result) {
      setIsRerouting(false);
      return; // keep current route — user may return to path
    }

    // Trim the path to start from the user's actual position so that
    // directions reflect reality, not the graph's snap node offset.
    const trimmed = trimPathFromUser(userLocation, result);

    setActivePath(trimmed);
    const newSteps = buildDirectionsFromPath(trimmed);
    setNavSteps(newSteps);
    setActiveStepIndex(0);
    navStartTimeRef.current = Date.now();
    locationHistoryRef.current = [];

    // Dismiss rerouting indicator after 2 seconds
    rerouteTimerRef.current = setTimeout(() => {
      setIsRerouting(false);
    }, 2000);
  }, [activeStepIndex, activePath, graph, navigationMode, navSteps.length, routeDestination, routeEnd, userLocation]);

  // Auto-exit navigation when user reaches the destination.
  // Six checks run on every location update (first match wins):
  //   1. User's GPS position is inside the destination building polygon.
  //   2. User is within 20m of any edge of the building polygon.
  //   3. Dynamic centroid proximity — scales with building size.
  //   4. Within 25m of the final path node (arrive step).
  //   5. Total remaining route distance ≤ 30m.
  //   5. Fixed centroid fallback (35m) for non-polygon destinations.
  useEffect(() => {
    if (!navigationMode || !userLocation) {
      return;
    }

    const hasPolygon =
      routeDestination?.geometry?.type === "Polygon" &&
      Array.isArray(routeDestination.geometry.coordinates?.[0]);
    const ring = hasPolygon
      ? (routeDestination!.geometry as { coordinates: number[][][] }).coordinates[0]
      : null;

    // 1. Point-in-polygon (most reliable — works for any building size)
    if (ring && isPointInPolygon(userLocation, ring)) {
      exitNavigation();
      setHasArrived(true);
      return;
    }

    // 2. Edge proximity — catches "standing at the entrance" even when
    //    GPS drifts just outside the polygon boundary.
    if (ring) {
      const edgeDist = minDistanceToPolygonEdge(userLocation, ring);
      if (edgeDist <= ARRIVAL_EDGE_PROXIMITY_METERS) {
        exitNavigation();
        setHasArrived(true);
        return;
      }
    }

    // 3. Dynamic centroid proximity — use the building's bounding radius
    //    so large buildings (rec center, library) don't require the user
    //    to reach the centroid, which may be deep inside the structure.
    if (routeEnd && ring) {
      const boundingRadius = polygonBoundingRadius(routeEnd, ring);
      const dynamicThreshold = Math.max(boundingRadius, ARRIVAL_PROXIMITY_METERS) + ARRIVAL_CENTROID_BUFFER_METERS;
      const distToBuilding = distanceBetweenCoordinatesMeters(
        userLocation,
        routeEnd,
      );
      if (distToBuilding <= dynamicThreshold) {
        exitNavigation();
        setHasArrived(true);
        return;
      }
    }

    // 4. Path endpoint check (25m — relaxed to account for GPS accuracy)
    if (navSteps.length > 0) {
      const lastStep = navSteps[navSteps.length - 1];
      if (lastStep.maneuver === "arrive") {
        const distToPathEnd = distanceBetweenCoordinatesMeters(
          userLocation,
          lastStep.to,
        );
        if (distToPathEnd <= ARRIVAL_PATH_END_METERS) {
          exitNavigation();
          setHasArrived(true);
          return;
        }
      }
    }

    // 5. Remaining route distance — if there's almost no route left to
    //    walk, the user has arrived regardless of building geometry.
    //    Uses straight-line distance to the current step endpoint plus
    //    the sum of all future step distances as an approximation.
    if (navSteps.length > 0 && activeStepIndex < navSteps.length) {
      const currentStepRemaining = distanceBetweenCoordinatesMeters(
        userLocation,
        navSteps[activeStepIndex].to,
      );
      const futureStepDistance = navSteps
        .slice(activeStepIndex + 1)
        .reduce((sum, step) => sum + step.distance, 0);
      if (currentStepRemaining + futureStepDistance <= ARRIVAL_REMAINING_ROUTE_METERS) {
        exitNavigation();
        setHasArrived(true);
        return;
      }
    }

    // 6. Fixed centroid fallback for non-polygon destinations (points, etc.)
    if (routeEnd && !ring) {
      const distToBuilding = distanceBetweenCoordinatesMeters(
        userLocation,
        routeEnd,
      );
      if (distToBuilding <= ARRIVAL_PROXIMITY_METERS) {
        exitNavigation();
        setHasArrived(true);
      }
    }
  }, [activeStepIndex, exitNavigation, navigationMode, navSteps, routeDestination, routeEnd, userLocation]);

  const clearRoute = useCallback(() => {
    setRouteStart(null);
    setRouteEnd(null);
    setActivePath(null);
    setRouteError(null);
    setRouteRequested(false);
    setRouteStartIsCurrentLocation(false);
    setRouteDestination(null);
  }, []);

  const dismissArrival = useCallback(() => {
    setHasArrived(false);
    setRouteStart(null);
    setRouteEnd(null);
    setActivePath(null);
    setRouteError(null);
    setRouteRequested(false);
    setRouteStartIsCurrentLocation(false);
    setRouteDestination(null);
    setActiveRoute(null);
    setRoutingActive(false);
    setMapMode("buildings");
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
      routeDestination,
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
      setMapDataStatus,
      retryMapData,
      clearRoute,
      navigationMode,
      navSteps,
      activeStepIndex,
      startNavigation,
      exitNavigation,
      graph,
      setGraph,
      isRerouting,
      hasArrived,
      dismissArrival,
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
      routeDestination,
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
      setMapDataStatus,
      retryMapData,
      clearRoute,
      navigationMode,
      navSteps,
      activeStepIndex,
      startNavigation,
      exitNavigation,
      graph,
      isRerouting,
      hasArrived,
      dismissArrival,
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
