import React from "react";
import { useCallback, useState } from "react";

export const [search, setSearch] = useState("");

export const useSearch = useCallback((text?: string) => {
    if (text !== undefined) {
        setSearch(text);
    }
 }, [setSearch]);

export const getSearch = React.useCallback((text: string) => {
    return search;
}, [search]);