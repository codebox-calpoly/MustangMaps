import React, { useRef, useState } from "react";
import {StyleSheet} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapContainer } from "../components/map/MapContainer";
import { BuildingLayer } from "../components/map/layers/BuildingLayer";
import { MapProvider } from "../context/MapContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <MapProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <MapContainer>
            <BuildingLayer />
          </MapContainer>
        </SafeAreaView>
      </MapProvider>
    </SafeAreaProvider>
  );
}
