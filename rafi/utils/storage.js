// localStorage Utilities
// Helper functions for safe localStorage operations

/**
 * Safely get an item from localStorage
 * Returns null if the item doesn't exist or if there's a parse error
 *
 * @param {string} key - localStorage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Parsed value from localStorage or default value
 *
 * @example
 * const userData = getLocalStorage('user', { name: 'Guest' });
 */
export function getLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage
 * Automatically stringifies the value
 *
 * @param {string} key - localStorage key
 * @param {*} value - Value to store (will be JSON stringified)
 * @returns {boolean} True if successful, false otherwise
 *
 * @example
 * setLocalStorage('user', { name: 'John', age: 30 });
 */
export function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Remove an item from localStorage
 *
 * @param {string} key - localStorage key to remove
 * @returns {boolean} True if successful, false otherwise
 *
 * @example
 * removeLocalStorage('tempData');
 */
export function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing from localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all items from localStorage
 *
 * @returns {boolean} True if successful, false otherwise
 *
 * @example
 * clearLocalStorage(); // Clears all stored data
 */
export function clearLocalStorage() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
}

/**
 * Get a simple string value from localStorage (no JSON parsing)
 *
 * @param {string} key - localStorage key
 * @param {string} defaultValue - Default value if key doesn't exist
 * @returns {string} Value from localStorage or default value
 *
 * @example
 * const theme = getLocalStorageString('theme', 'light');
 */
export function getLocalStorageString(key, defaultValue = '') {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (error) {
    console.error(`Error reading string from localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set a simple string value in localStorage (no JSON stringification)
 *
 * @param {string} key - localStorage key
 * @param {string} value - String value to store
 * @returns {boolean} True if successful, false otherwise
 *
 * @example
 * setLocalStorageString('theme', 'dark');
 */
export function setLocalStorageString(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Error writing string to localStorage key "${key}":`, error);
    return false;
  }
}
