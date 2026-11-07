import { isEqual } from 'lodash';
import { clone } from '@shell/utils/object';
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

// CNI types whose NADs can be swapped on a running VM, as long as the old and new NAD share the type
const LIVE_SWAP_NAD_TYPES = ['bridge', 'kube-ovn'];
// The management network NAD is of type kube-ovn too, but it is not a VM network that can be swapped live
const MGMT_NAD_ID = 'harvester-system/mgmt';

/**
 * CNI type of the NAD a multus networkName refers to, if KubeVirt can swap it on a running VM:
 * `bridge` (VLAN / untagged networks) or `kube-ovn` (overlay networks), otherwise undefined.
 * A name without a namespace is resolved in the VM's namespace, as KubeVirt and the Harvester
 * webhook do.
 * @param {Array} nads - NetworkAttachmentDefinitions of the store
 * @param {String} networkName - `<namespace>/<name>` or `<name>`
 * @param {String} vmNamespace
 */
export function liveSwapNADType(nads, networkName, vmNamespace) {
  if (!networkName) return undefined;

  const id = networkName.includes('/') ? networkName : `${ vmNamespace || 'default' }/${ networkName }`;

  if (id === MGMT_NAD_ID) return undefined;

  const type = (nads || []).find((nad) => nad.id === id)?.parseConfig?.type;

  return LIVE_SWAP_NAD_TYPES.includes(type) ? type : undefined;
}

/**
 * Whether a NIC can move from one NAD to another on a running VM without a restart: both NADs
 * must be of the same live-swappable type (bridge to bridge, or overlay to overlay). Bridge to
 * overlay changes the interface binding, which KubeVirt only applies on restart.
 * @param {Array} nads - NetworkAttachmentDefinitions of the store
 * @param {String} oldNetworkName
 * @param {String} newNetworkName
 * @param {String} vmNamespace
 */
export function canLiveSwapNAD(nads, oldNetworkName, newNetworkName, vmNamespace) {
  const oldType = liveSwapNADType(nads, oldNetworkName, vmNamespace);

  return !!oldType && oldType === liveSwapNADType(nads, newNetworkName, vmNamespace);
}

/**
 * Drop the empty node affinity terms that the shell NodeScheduling form adds on load
 * (`preferredDuringSchedulingIgnoredDuringExecution: []` and
 * `requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: [] }`), so that opening
 * the Node Scheduling tab doesn't count as a spec change.
 * @param {Object} spec - VM spec, modified in place
 */
function dropEmptyNodeAffinityTerms(spec) {
  const affinity = spec?.template?.spec?.affinity;
  const nodeAffinity = affinity?.nodeAffinity;

  if (!nodeAffinity) return;

  if (Array.isArray(nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution) && !nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution.length) {
    delete nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution;
  }

  const required = nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution;

  if (required && Object.keys(required).length === 1 && Array.isArray(required.nodeSelectorTerms) && !required.nodeSelectorTerms.length) {
    delete nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution;
  }

  if (!Object.keys(nodeAffinity).length) {
    delete affinity.nodeAffinity;
  }
}

/**
 * Drop the core binding (`bridge`, `masquerade`) of interfaces that use a binding plugin, such as
 * `managedtap` on overlay networks. The form adds `bridge: {}` next to the plugin binding it keeps
 * from the spec, and the webhook removes it again on save, so it is not a real change.
 * @param {Object} spec - VM spec, modified in place
 */
function dropCoreBindingOfPluginInterfaces(spec) {
  (spec?.template?.spec?.domain?.devices?.interfaces || []).forEach((iface) => {
    if (iface.binding) {
      delete iface.bridge;
      delete iface.masquerade;
    }
  });
}

/**
 * Whether the only spec change between two VMs is the multus networkName (NAD) of existing
 * networks, each moved to a NAD of the same type (see canLiveSwapNAD). KubeVirt
 * (LiveUpdateNADRef) applies such a change to a running VM via live migration, so no restart is
 * needed.
 * @param {Object} oldVM
 * @param {Object} newVM
 * @param {Function} canSwap - (oldNetworkName, newNetworkName) => boolean
 */
export function isNADOnlyChange(oldVM, newVM, canSwap) {
  const oldSpec = clone(oldVM?.spec || {});
  const newSpec = clone(newVM?.spec || {});
  const oldNetworks = oldSpec.template?.spec?.networks || [];
  const newNetworks = newSpec.template?.spec?.networks || [];

  if (oldNetworks.length !== newNetworks.length) return false;

  let nadChanged = false;

  for (let i = 0; i < newNetworks.length; i++) {
    const oldNet = oldNetworks[i];
    const newNet = newNetworks[i];

    if (oldNet.name !== newNet.name) return false;

    const oldNAD = oldNet.multus?.networkName;
    const newNAD = newNet.multus?.networkName;

    if (oldNAD === newNAD) continue;
    if (!oldNAD || !newNAD || oldNet.multus?.default || !canSwap(oldNAD, newNAD)) return false;

    nadChanged = true;
    oldNet.multus.networkName = '';
    newNet.multus.networkName = '';
  }

  if (!nadChanged) return false;

  dropEmptyNodeAffinityTerms(oldSpec);
  dropEmptyNodeAffinityTerms(newSpec);
  dropCoreBindingOfPluginInterfaces(oldSpec);
  dropCoreBindingOfPluginInterfaces(newSpec);

  return isEqual(oldSpec, newSpec);
}
