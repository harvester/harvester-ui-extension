import { computed } from 'vue';
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

// Every VMI needs its newest migration, which is also part of the VM state in the list. Instead of filtering and sorting
// all migrations per VMI, build one index (namespace/vmiName -> newest migration) that all VMIs share. Same idea as the
// launcher pod index in models/kubevirt.io.virtualmachine.js: the WeakMap is keyed by the store list (collected together
// with it), the `computed` rebuilds lazily after any migration changed.
const _migrationIndexes = new WeakMap();

/**
 * The index of a store list of migrations: namespace/vmiName -> newest migration (by creationTimestamp).
 *
 * `migrations` must be the list of the store, not a copy, the index is cached per list. Migrations without a vmiName are
 * not indexed, of two migrations with the same creationTimestamp the first one in the list wins.
 */
function getLatestMigrationIndex(migrations) {
  let index = _migrationIndexes.get(migrations);

  if (!index) {
    index = computed(() => {
      const latest = new Map();

      for (const migration of migrations) {
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
    _migrationIndexes.set(migrations, index);
  }

  return index.value;
}

/**
 * The newest migration of a VMI, or undefined if there is none.
 *
 * The migrations are passed in, so the caller decides which store they come from (the store differs between the Harvester
 * product and the Rancher explorer).
 */
export function getLatestMigration(migrations, namespace, vmiName) {
  if (!vmiName) {
    return undefined;
  }

  return getLatestMigrationIndex(migrations).get(`${ namespace }/${ vmiName }`);
}
