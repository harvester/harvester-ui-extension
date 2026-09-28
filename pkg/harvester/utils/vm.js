import { isEqual } from 'lodash';
import { clone } from '@shell/utils/object';
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
 * Whether the only spec change between two VMs is the multus networkName (NAD) of existing
 * bridge networks. KubeVirt (LiveUpdateNADRef) applies such a change to a running VM via live
 * migration, so no restart is needed.
 * @param {Object} oldVM
 * @param {Object} newVM
 * @param {Function} isBridgeNAD - (networkName) => boolean
 */
export function isNADOnlyChange(oldVM, newVM, isBridgeNAD) {
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
    if (!oldNAD || !newNAD || oldNet.multus?.default || !isBridgeNAD(oldNAD) || !isBridgeNAD(newNAD)) return false;

    nadChanged = true;
    oldNet.multus.networkName = '';
    newNet.multus.networkName = '';
  }

  return nadChanged && isEqual(oldSpec, newSpec);
}
