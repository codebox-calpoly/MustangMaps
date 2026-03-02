import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as FileSystem from "expo-file-system/legacy";

export type SavedPlace = {
  id: string;
  name: string;
  coordinate: [number, number];
  updatedAt: number;
  ref?: string;
};

type SavedPlacesState = {
  history: SavedPlace[];
  favorites: SavedPlace[];
};

type SavedPlacesContextValue = {
  history: SavedPlace[];
  favorites: SavedPlace[];
  addToHistory: (place: SavedPlace) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  toggleFavorite: (place: SavedPlace) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
};

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ""}saved_places.json`;

const SavedPlacesContext = createContext<SavedPlacesContextValue | undefined>(
  undefined,
);

function isValidCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => Number.isFinite(item))
  );
}

function sanitizePlaces(list: SavedPlace[] | undefined): SavedPlace[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((place) => isValidCoordinate(place.coordinate));
}

function normalizeUnique(list: SavedPlace[], place: SavedPlace) {
  const filtered = list.filter((item) => item.id !== place.id);
  return [place, ...filtered];
}

export function SavedPlacesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [history, setHistory] = useState<SavedPlace[]>([]);
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(STORAGE_FILE);
        if (!info.exists) {
          return;
        }
        const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
        const parsed = JSON.parse(raw) as SavedPlacesState;
        if (!cancelled) {
          setHistory(sanitizePlaces(parsed.history));
          setFavorites(sanitizePlaces(parsed.favorites));
        }
      } catch {
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const payload: SavedPlacesState = { history, favorites };
    FileSystem.writeAsStringAsync(
      STORAGE_FILE,
      JSON.stringify(payload),
    ).catch(() => {
    });
  }, [history, favorites]);

  const addToHistory = useCallback((place: SavedPlace) => {
    setHistory((prev) =>
      normalizeUnique(prev, { ...place, updatedAt: Date.now() }),
    );
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const toggleFavorite = useCallback((place: SavedPlace) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.id === place.id);
      if (exists) {
        return prev.filter((item) => item.id !== place.id);
      }
      return normalizeUnique(prev, { ...place, updatedAt: Date.now() });
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((item) => item.id === id),
    [favorites],
  );

  const value = useMemo(
    () => ({
      history,
      favorites,
      addToHistory,
      removeFromHistory,
      clearHistory,
      toggleFavorite,
      removeFavorite,
      isFavorite,
    }),
    [
      history,
      favorites,
      addToHistory,
      removeFromHistory,
      clearHistory,
      toggleFavorite,
      removeFavorite,
      isFavorite,
    ],
  );

  return (
    <SavedPlacesContext.Provider value={value}>
      {children}
    </SavedPlacesContext.Provider>
  );
}

export function useSavedPlaces() {
  const context = useContext(SavedPlacesContext);
  if (!context) {
    throw new Error("useSavedPlaces must be used within SavedPlacesProvider");
  }
  return context;
}
