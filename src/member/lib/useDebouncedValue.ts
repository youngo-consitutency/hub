import { useEffect, useState } from 'react'

// Returns `value` after it has been stable for `delay` ms. Search-style inputs
// feed the debounced value into useApi so each keystroke does not fire a
// request — one request per pause instead.
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
