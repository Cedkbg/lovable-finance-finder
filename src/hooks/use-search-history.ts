import { useState, useCallback, useEffect } from "react";


export interface SearchHistoryItem {
  query: string;
  assetName: string | null;
  source: string;
  timestamp: number;
}

const STORAGE_KEY = "enricher_search_history";
const MAX_ITEMS = 50;

function loadHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>(loadHistory);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addEntry = useCallback((item: Omit<SearchHistoryItem, "timestamp">) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.query !== item.query);
      return [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
