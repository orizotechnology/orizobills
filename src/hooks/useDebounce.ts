import { useState, useEffect } from "react";

// =============================================================
// useDebounce
// Delays updating a value until the user stops changing it.
// Usage: const debouncedSearch = useDebounce(searchTerm, 400);
// =============================================================

export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
