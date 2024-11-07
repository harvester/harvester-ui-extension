import semver from 'semver';
import { HCI } from '../types';
import { RELEASE_FEATURES } from '../config/feature-flags';

export function serverVersion(getters) {
  // e.g v1.4.0
  if (process.env.VUE_APP_SERVER_VERSION) {
    return process.env.VUE_APP_SERVER_VERSION;
  }

  try {
    const v = getters['harvester/byId'](HCI.SETTING, 'server-version')?.value;

    return `v${ semver.major(v) }.${ semver.minor(v) }.${ semver.patch(v) }`;
  } catch (error) {}

  return '';
}

export const featureEnabled = (getters, featureKey) => {
  const version = serverVersion(getters);

  return !!RELEASE_FEATURES[version]?.[featureKey] || false;
};
