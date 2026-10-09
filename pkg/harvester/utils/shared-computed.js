import { computed } from 'vue';

// Caches a value that all rows derive from the same shared store object (e.g. a lookup index of a whole list).
// The WeakMap is keyed by that object, so the value is dropped together with it. The value is a `computed`, so it is
// derived again after the reactive data it read changed.
const _computedsBySource = new WeakMap();

/**
 * Runs `fn(source)` once per source object instead of once per call, and again when its reactive data changed.
 * `key` tells apart several shared computeds of the same source. For a list, `source` must be the store list, not a copy.
 */
export function sharedComputed(source, key, fn) {
  let perSource = _computedsBySource.get(source);

  if (!perSource) {
    perSource = new Map();
    _computedsBySource.set(source, perSource);
  }

  if (!perSource.has(key)) {
    perSource.set(key, computed(() => fn(source)));
  }

  return perSource.get(key).value;
}
