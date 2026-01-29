import { StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import * as Location from "expo-location";

// Retrieves user's latitude and longitude
const UseLocation = () => {
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [longitude] = useState<number | null>(null);
  const [latitude] = useState<number | null>(null);

  const getUserLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();

    // Returns error message if location not granted
    if (status !== "granted") {
      setErrorMsg("Permission to location was not granted");
      return;
    }

    let { coords } = await Location.getCurrentPositionAsync();

    if (coords) {
      const { latitude, longitude } = coords;
      console.log("lat and long is", latitude, longitude);
    }
  };

  useEffect(() => {
    getUserLocation();
  }, [])

  return { latitude, longitude, errorMsg };
};

export default UseLocation;
const styles = StyleSheet.create({});
