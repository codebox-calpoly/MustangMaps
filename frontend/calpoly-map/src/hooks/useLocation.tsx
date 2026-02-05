import { StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

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

        // 3) Initial position (consider adding a timeout)
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setLatitude(current.coords.latitude);
          setLongitude(current.coords.longitude);
        }

        // 4) Live updates
        subRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!isMounted) return;
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
const styles = StyleSheet.create({});
