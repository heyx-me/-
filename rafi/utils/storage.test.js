import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getLocalStorage, 
  setLocalStorage, 
  removeLocalStorage, 
  clearLocalStorage,
  getLocalStorageString,
  setLocalStorageString 
} from './storage';

describe('storage.js', () => {
  const localStorageMock = (function() {
    let store = {};
    return {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((i) => Object.keys(store)[i] || null),
    };
  })();

  beforeEach(() => {
    // Replace global localStorage with mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getLocalStorage', () => {
    it('should return default value if key does not exist', () => {
      const result = getLocalStorage('nonexistent', 'default');
      expect(result).toBe('default');
    });

    it('should return parsed object if key exists', () => {
      localStorage.setItem('testKey', JSON.stringify({ a: 1 }));
      const result = getLocalStorage('testKey');
      expect(result).toEqual({ a: 1 });
    });

    it('should handle invalid JSON and return default', () => {
      localStorage.setItem('testKey', 'invalid-json');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = getLocalStorage('testKey', 'fallback');
      
      expect(result).toBe('fallback');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setLocalStorage', () => {
    it('should save object as JSON string', () => {
      setLocalStorage('testKey', { a: 1 });
      expect(localStorage.getItem('testKey')).toBe('{"a":1}');
    });
  });

  describe('removeLocalStorage', () => {
    it('should remove item', () => {
      localStorage.setItem('testKey', 'value');
      removeLocalStorage('testKey');
      expect(localStorage.getItem('testKey')).toBeNull();
    });
  });

  describe('clearLocalStorage', () => {
    it('should clear all items', () => {
      localStorage.setItem('a', '1');
      localStorage.setItem('b', '2');
      clearLocalStorage();
      expect(localStorage.length).toBe(0);
    });
  });

  describe('String helpers', () => {
    it('getLocalStorageString should return raw string', () => {
      localStorage.setItem('testKey', 'raw-value');
      expect(getLocalStorageString('testKey')).toBe('raw-value');
    });

    it('setLocalStorageString should save raw string', () => {
      setLocalStorageString('testKey', 'raw-value');
      expect(localStorage.getItem('testKey')).toBe('raw-value');
    });
  });
});
