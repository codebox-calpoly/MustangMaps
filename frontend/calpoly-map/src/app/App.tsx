import React, { useRef, useState } from "react";
import {StyleSheet} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';
import { ClassZonesLayer } from '../components/map/layers/ClassZonesLayer';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <MapContainer>
          <BuildingLayer />
	  <ClassZonesLayer />
        </MapContainer> 
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
