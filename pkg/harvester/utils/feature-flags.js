import semver from 'semver';
import { RELEASE_FEATURES } from '../config/feature-flags';

export const docLink = (suffix, version) => {
  const docVersion = `v${ semver.major(version) }.${ semver.minor(version) }`;

  return `https://docs.harvesterhci.io/${ docVersion }${ suffix }`;
};

export function featureVersion(v) {
  // e.g v1.4.0
  if (process.env.VUE_APP_SERVER_VERSION) {
    return process.env.VUE_APP_SERVER_VERSION;
  }

  try {
    return `v${ semver.major(v) }.${ semver.minor(v) }.${ semver.patch(v) }`;
  } catch (error) {
    // fallback to the latest version
    return Object.keys(RELEASE_FEATURES).sort((a, b) => semver.compare(a, b)).pop();
  }
}

export const featureEnabled = (featureKey, serverVersion) => {
  const version = featureVersion(serverVersion);
  const releasedFeatures = RELEASE_FEATURES[version] || [];

  return releasedFeatures.includes(featureKey);
};
