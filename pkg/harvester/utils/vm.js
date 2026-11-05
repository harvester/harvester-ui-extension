import { sharedComputed } from './shared-computed';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';

export function parseVolumeClaimTemplates(data) {
  let out = [];

  try {
    out = JSON.parse(data?.metadata?.annotations?.[HCI_ANNOTATIONS.VOLUME_CLAIM_TEMPLATE]) || [];
  } catch (e) {}

  return out;
}

export const EMPTY_IMAGE = 'EMPTY_IMAGE';

/**
 * Disks and interfaces that take part in the boot sequence, sorted by boot order.
 */
export function getBootDevices(devices = {}) {
  return [...(devices.disks || []), ...(devices.interfaces || [])]
    .filter((device) => !!device.bootOrder)
    .sort((a, b) => a.bootOrder - b.bootOrder);
}

// Index of the migrations (namespace/vmiName -> newest migration), shared by all VMIs. `migrations` must be the store list,
// not a copy. Of two migrations with the same creationTimestamp the first one wins.
function getLatestMigrationIndex(migrations) {
  return sharedComputed(migrations, 'latestMigrationIndex', (list) => {
    const latest = new Map();

    for (const migration of list) {
      const name = migration.spec?.vmiName;

      if (!name) {
        continue;
      }

      const key = `${ migration.metadata?.namespace }/${ name }`;
      const previous = latest.get(key);

      if (!previous || migration.metadata?.creationTimestamp > previous.metadata?.creationTimestamp) {
        latest.set(key, migration);
      }
    }

    return latest;
  });
}

/**
 * The newest migration of a VMI, or undefined if there is none. The caller passes the migrations of its store.
 */
export function getLatestMigration(migrations, namespace, vmiName) {
  if (!vmiName) {
    return undefined;
  }

  return getLatestMigrationIndex(migrations).get(`${ namespace }/${ vmiName }`);
}
