import semver from 'semver';
import { HCI } from '../types';
import { RELEASE_FEATURES } from '../config/feature-flags';

export const docLink = (suffix, getter) => {
  const v = serverVersion(getter);

  const docVersion = `v${ semver.major(v) }.${ semver.minor(v) }`;

  return `https://docs.harvesterhci.io/${ docVersion }${ suffix }`;
};

export function serverVersion(getters) {
  // e.g v1.4.0
  if (process.env.VUE_APP_SERVER_VERSION) {
    return process.env.VUE_APP_SERVER_VERSION;
  }

  try {
    const v = getters['harvester/byId'](HCI.SETTING, 'server-version')?.value;

    return `v${ semver.major(v) }.${ semver.minor(v) }.${ semver.patch(v) }`;
  } catch (error) {
    // fallback to the latest version
    return Object.keys(RELEASE_FEATURES).sort((a, b) => semver.compare(a, b)).pop();
  }
}

export const featureEnabled = (getters, featureKey) => {
  const version = serverVersion(getters);
  const releasedFeatures = RELEASE_FEATURES[version] || [];

  return releasedFeatures.includes(featureKey);
};
