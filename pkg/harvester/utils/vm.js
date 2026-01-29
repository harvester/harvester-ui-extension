import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';

export function parseVolumeClaimTemplates(data) {
  let out = [];

  try {
    out = JSON.parse(data?.metadata?.annotations?.[HCI_ANNOTATIONS.VOLUME_CLAIM_TEMPLATE]) || [];
  } catch (e) {}

  return out;
}

export const EMPTY_IMAGE = 'EMPTY_IMAGE';
