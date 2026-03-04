import { useCallback, useState } from "react";

export function useSearch(initialValue = "") {
  const [search, setSearch] = useState(initialValue);

  const updateSearch = useCallback((text: string) => {
    setSearch(text);
  }, []);

  return {
    search,
    setSearch: updateSearch,
  };
}
