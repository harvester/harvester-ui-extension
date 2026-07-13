// Shared helpers for the Forklift VM-migration feature.
// Keep the map-spec builders here so the wizard step and the review step
// (and any future edit flow) stay in sync instead of drifting apart.

export const FORKLIFT_API_VERSION = 'forklift.konveyor.io/v1beta1';

/**
 * Decode a base64 value stored in a k8s Secret, tolerating malformed input.
 */
export function decodeSecretValue(val) {
  try {
    return atob(val || '');
  } catch (e) {
    return '';
  }
}

/**
 * Bytes → whole GiB (rounded). Returns 0 for falsy input.
 */
export function bytesToGB(bytes) {
  return Math.round((bytes || 0) / (1024 * 1024 * 1024));
}

/**
 * MiB → whole GiB (rounded). Returns 0 for falsy input.
 */
export function mbToGB(mb) {
  return Math.round((mb || 0) / 1024);
}

/**
 * Build the `spec.map` entries for a Forklift NetworkMap from wizard entries.
 * Entries without a chosen target are dropped so we never emit an invalid
 * multus destination with an empty name.
 *
 * @param {Array}  entries          network mapping entries ({ name, id, target })
 * @param {string} defaultNamespace namespace to use when the target has no `ns/` prefix
 */
export function buildNetworkMapEntries(entries = [], defaultNamespace) {
  return entries
    .filter((entry) => !!entry.target)
    .map((entry) => {
      const source = { name: entry.name, id: entry.id };

      if (entry.target === 'pod') {
        return { source, destination: { type: 'pod' } };
      }

      if (entry.target === 'ignored') {
        return { source, destination: { type: 'ignored' } };
      }

      const parts = entry.target.split('/');
      const name = parts.length > 1 ? parts[1] : parts[0];
      const namespace = parts.length > 1 ? parts[0] : defaultNamespace;

      return {
        source,
        destination: {
          type: 'multus', name, namespace
        },
      };
    });
}

/**
 * Build the `spec.map` entries for a Forklift StorageMap from wizard entries.
 * Entries without a chosen target are dropped.
 *
 * @param {Array} entries storage mapping entries ({ name, id, target })
 */
export function buildStorageMapEntries(entries = []) {
  return entries
    .filter((entry) => !!entry.target)
    .map((entry) => ({
      source:      { name: entry.name, id: entry.id },
      destination: { storageClass: entry.target },
    }));
}
