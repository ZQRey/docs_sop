import { useEffect, useState } from "react";
export function useDebounce(value: string, delay = 250) {
  const [debounced, set] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => set(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
