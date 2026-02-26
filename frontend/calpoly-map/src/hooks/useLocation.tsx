import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

// Maximum accepted accuracy in meters — readings less precise than this are discarded.
const ACCURACY_THRESHOLD = 25;

// Retrieves user's latitude and longitude
const UseLocation = () => {
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);

  const subRef = useRef<Location.LocationSubscription | null>(null);

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

        // 3) Initial position — use high accuracy for a solid first fix
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setLatitude(current.coords.latitude);
          setLongitude(current.coords.longitude);
        }

        // 4) Live updates — balanced accuracy + larger distance filter to avoid jitter
        subRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (loc) => {
            if (!isMounted) return;
            // Discard inaccurate readings that would make the marker jump
            if (
              loc.coords.accuracy != null &&
              loc.coords.accuracy > ACCURACY_THRESHOLD
            ) {
              return;
            }
            setLatitude(loc.coords.latitude);
            setLongitude(loc.coords.longitude);
          }
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
