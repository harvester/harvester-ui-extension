import semver from 'semver';
import { RELEASE_FEATURES } from '../config/feature-flags';

export const docLink = (suffix, version) => {
  const docVersion = `v${ semver.major(version) }.${ semver.minor(version) }`;

  return `https://docs.harvesterhci.io/${ docVersion }${ suffix }`;
};

export function getVersion(v) {
  if (process.env.VUE_APP_SERVER_VERSION) {
    return process.env.VUE_APP_SERVER_VERSION;
  }

  try {
    // v1.4.1-rc.1 => v1.4.1, v1.4.1-dev-20241222 => v1.4.1
    return `v${ semver.major(v) }.${ semver.minor(v) }.${ semver.patch(v) }`;
  } catch (error) {
    // fallback to the latest version
    return latestVersion();
  }
}

function latestVersion() {
  return getLatestVersion(Object.keys(RELEASE_FEATURES));
}

function getLatestVersion(versions) {
  if (!versions || !versions.length) {
    // return the latest feature flag version in RELEASE_FEATURES
    return Object.keys(RELEASE_FEATURES).sort((a, b) => semver.compare(a, b)).pop();
  }

  return versions.sort((a, b) => semver.compare(a, b)).pop();
}

// We need to find the latest supported feature flags if new version feature flag not exist.
// This happens in either one of scenarios below
// when user import new version harvester (e.g. v1.3.3), but ui ext still in v1.3.2
// when user import new version harvester (e.g. v1.6.0), but ui ext still in v1.5.1
function latestSupportedVersion(v) {
  let minorPrefix = `v${ semver.major(v) }.${ semver.minor(v) }`;

  let minorVersions = Object.keys(RELEASE_FEATURES).filter((version) => version.startsWith(minorPrefix));

  if (minorVersions.length === 0) {
    minorPrefix = `v${ semver.major(v) }.${ semver.minor(v) - 1 }`;
    minorVersions = Object.keys(RELEASE_FEATURES).filter((version) => version.startsWith(minorPrefix));
  }

  return getLatestVersion(minorVersions);
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
    const fallback = latestSupportedVersion(version);

    releasedFeatures = RELEASE_FEATURES[fallback];
  }

  if (releasedFeatures === undefined || releasedFeatures === null) {
    // eslint-disable-next-line no-console
    console.error(`Feature flags for version ${ version } are not defined. Please upgrade harvester ui extension to the latest version and check the support matrix.`);

    return false;
  }

  return releasedFeatures.includes(featureKey);
};
