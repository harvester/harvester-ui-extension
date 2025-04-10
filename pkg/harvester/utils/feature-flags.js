import semver from 'semver';
import { RELEASE_FEATURES } from '../config/feature-flags';

export const docLink = (suffix, version) => {
  const docVersion = `v${ semver.major(version) }.${ semver.minor(version) }`;

  return `https://docs.harvesterhci.io/${ docVersion }${ suffix }`;
};

export function getVersion(v) {
  // e.g v1.4.0
  if (process.env.VUE_APP_SERVER_VERSION) {
    return process.env.VUE_APP_SERVER_VERSION;
  }

  try {
    // v1.4.1-rc.1 => v1.4.1, v1.4.1-dev-20241222 => v1.4.1
    return `v${ semver.major(v) }.${ semver.minor(v) }.${ semver.patch(v) }`;
  } catch (error) {
    // fallback to the latest version
    return latestVersion(Object.keys(RELEASE_FEATURES));
  }
}

function latestVersion(versions) {
  return versions.sort((a, b) => semver.compare(a, b)).pop();
}

// v1.3.3 => latest v1.3.x, v1.4.2 => latest v1.4.x
function latestMinorVersion(v) {
  const minor = `v${ semver.major(v) }.${ semver.minor(v) }`;
  const minorVersions = Object.keys(RELEASE_FEATURES).filter((version) => version.startsWith(minor));

  return latestVersion(minorVersions);
}

export const featureEnabled = (featureKey, serverVersion) => {
  const minSupportedVersion = '1.3.0';

  const version = getVersion(serverVersion);

  if (semver.lt(version.replace('v', ''), minSupportedVersion)) {
    // eslint-disable-next-line no-console
    console.error(`Harvester UI extension only supports Harvester cluster version >= ${ minSupportedVersion }. Current version: ${ version }`);

    return false;
  }

  let releasedFeatures = RELEASE_FEATURES[version];

  if (!releasedFeatures) {
    const fallback = latestMinorVersion(version);

    releasedFeatures = RELEASE_FEATURES[fallback];
  }

  return releasedFeatures.includes(featureKey);
};
