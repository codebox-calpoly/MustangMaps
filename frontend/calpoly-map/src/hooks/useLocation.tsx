import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

// Readings with accuracy worse than this (in meters) are discarded.
const ACCURACY_THRESHOLD = 25;
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

        // 3) Instant initial position from the OS cache (no GPS wait)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && isMounted) {
          setLatitude(lastKnown.coords.latitude);
          setLongitude(lastKnown.coords.longitude);
          lastAcceptedRef.current = {
            lat: lastKnown.coords.latitude,
            lon: lastKnown.coords.longitude,
          };
        }

        // 4) Live updates — the watch will refine the position immediately
        subRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!isMounted) return;

            // Discard inaccurate readings
            if (
              loc.coords.accuracy != null &&
              loc.coords.accuracy > ACCURACY_THRESHOLD
            ) {
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

  return { latitude, longitude, errorMsg };
};

export default UseLocation;
