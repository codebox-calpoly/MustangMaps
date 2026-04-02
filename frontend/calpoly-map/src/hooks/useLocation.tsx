import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

// Readings with accuracy worse than this (in meters) are discarded.
const ACCURACY_THRESHOLD = 25;
// Cached (last-known) positions must be at least this accurate to be used as
// the initial position.  Stale cache hits from hours ago can be wildly off.
const CACHE_ACCURACY_THRESHOLD = 50;
// New readings closer than this to the last accepted position are treated as
// GPS drift and ignored, keeping the marker still when the phone is stationary.
const DRIFT_DEAD_ZONE_METERS = 3;

// Fast approximate distance between two lat/lng pairs (meters).
function approxDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = Math.PI / 180;
  const dx = (lon2 - lon1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad) * 6_371_000;
  const dy = (lat2 - lat1) * toRad * 6_371_000;
  return Math.sqrt(dx * dx + dy * dy);
}

// Retrieves user's latitude and longitude
const UseLocation = () => {
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastAcceptedRef = useRef<{ lat: number; lon: number } | null>(null);
  // Allow the first accurate watch reading to snap directly to the real
  // position without being blocked by the drift dead zone.
  const hasFirstWatchFixRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const startTracking = async () => {
      try {
        // 1) Make sure device services are enabled
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (isMounted) setErrorMsg("Location services are disabled on this device");
          return;
        }

        // 2) Ask permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (isMounted) setErrorMsg("Permission to location was not granted");
          return;
        }

        // 3) Get initial position fast: use cache and a quick Balanced fix
        //    in parallel so the user sees their dot as soon as possible.
        const applyFix = (loc: Location.LocationObject) => {
          if (!isMounted) return;
          const fixAccuracy = loc.coords.accuracy ?? null;
          if (fixAccuracy != null && fixAccuracy > CACHE_ACCURACY_THRESHOLD) return;
          // Only apply if we don't already have a position (avoid overwriting
          // a better fix that arrived first).
          if (lastAcceptedRef.current) return;
          setLatitude(loc.coords.latitude);
          setLongitude(loc.coords.longitude);
          setAccuracy(fixAccuracy);
          lastAcceptedRef.current = {
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
          };
        };

        // Fire both in parallel — whichever resolves first wins.
        const cachePromise = Location.getLastKnownPositionAsync().then(
          (pos) => { if (pos) applyFix(pos); },
        );
        const quickFixPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).then(applyFix);

        await Promise.allSettled([cachePromise, quickFixPromise]);

        // 4) Live updates — BestForNavigation uses additional sensors
        //    (gyroscope, accelerometer) for the highest precision.
        if (!isMounted) return;
        subRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!isMounted) return;

            const readingAccuracy = loc.coords.accuracy ?? null;

            // Discard inaccurate readings
            if (readingAccuracy != null && readingAccuracy > ACCURACY_THRESHOLD) {
              return;
            }

            const newLat = loc.coords.latitude;
            const newLon = loc.coords.longitude;

            // Let the first accurate watch reading snap straight to the real
            // position (the cached lastKnown may be far off). After that,
            // apply the drift dead zone to keep the marker stable.
            const prev = lastAcceptedRef.current;
            if (prev && hasFirstWatchFixRef.current) {
              const dist = approxDistanceMeters(prev.lat, prev.lon, newLat, newLon);
              if (dist < DRIFT_DEAD_ZONE_METERS) {
                return;
              }
            }
            hasFirstWatchFixRef.current = true;

            lastAcceptedRef.current = { lat: newLat, lon: newLon };
            setLatitude(newLat);
            setLongitude(newLon);
            setAccuracy(readingAccuracy);
          },
        );
      } catch (e: any) {
        if (isMounted) setErrorMsg(e?.message ?? String(e));
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, []);

  return { latitude, longitude, accuracy, errorMsg };
};

export default UseLocation;
