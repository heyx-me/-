import { useState, useEffect, useCallback } from "react";
import { debounce } from "../utils/index.js";
import { getLocalStorage, setLocalStorage } from "../utils/storage.js";

/**
 * useLocalStorageState Hook
 * State that automatically syncs with localStorage with debounced writes
 *
 * @param {string} key - localStorage key
 * @param {*} initialValue - Initial value if localStorage is empty
 * @param {Object} options - Configuration options
 * @param {number} options.debounceMs - Debounce delay in ms (default: 1000)
 * @param {Function} options.serialize - Custom serialization (default: JSON)
 * @param {Function} options.deserialize - Custom deserialization (default: JSON)
 * @returns {[*, Function]} [state, setState] tuple like useState
 *
 * @example
 * const [config, setConfig] = useLocalStorageState('appConfig', { theme: 'dark' });
 */
export function useLocalStorageState(key, initialValue, options = {}) {
  const {
    debounceMs = 1000,
    serialize = (value) => value,
    deserialize = (value) => value
  } = options;

  // Initialize state from localStorage or use initial value
  const [state, setState] = useState(() => {
    const savedValue = getLocalStorage(key);
    if (savedValue !== null && savedValue !== undefined) {
      return deserialize(savedValue);
    }
    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  // Debounced save to localStorage
  const debouncedSave = useCallback(
    debounce((value) => {
      setLocalStorage(key, serialize(value));
    }, debounceMs),
    [key, debounceMs]
  );

  // Save to localStorage when state changes
  useEffect(() => {
    debouncedSave(state);
  }, [state, debouncedSave]);

  return [state, setState];
}

/**
 * useLocalStorageValue Hook
 * Simplified version for direct localStorage sync without debouncing
 *
 * @param {string} key - localStorage key
 * @param {*} defaultValue - Default value if not found
 * @returns {[*, Function]} [value, setValue] tuple
 *
 * @example
 * const [apiKey, setApiKey] = useLocalStorageValue('api_key', '');
 */
export function useLocalStorageValue(key, defaultValue) {
  const [value, setValue] = useState(() => {
    return getLocalStorage(key, defaultValue);
  });

  const setStoredValue = useCallback((newValue) => {
    const valueToStore = typeof newValue === 'function' ? newValue(value) : newValue;
    setValue(valueToStore);
    setLocalStorage(key, valueToStore);
  }, [key, value]);

  return [value, setStoredValue];
}
