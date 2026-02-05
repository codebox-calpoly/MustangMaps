import React, { createContext, useContext } from "react";
import UseLocation from "../hooks/useLocation";

type locationContextType = {
    latitude: number | null;
    longitude: number | null;
    errorMsg: string | null;
    };

const LocationContext = createContext<locationContextType | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const { latitude, longitude, errorMsg } = UseLocation();

    return (
        <LocationContext.Provider value={{ latitude, longitude, errorMsg }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useUserLocation() {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error("useLocationContext must be used within a LocationProvider");
    }
    return context;
}