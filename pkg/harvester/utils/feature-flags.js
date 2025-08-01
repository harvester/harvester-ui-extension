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
    return getLatestVersion();
  }
}

function getLatestVersion() {
  const allVersions = Object.keys(RELEASE_FEATURES).filter(semver.valid).sort(semver.rcompare);

  return allVersions[0] || '';
}

function getLatestCompatibleVersion(version) {
  const allVersions = Object.keys(RELEASE_FEATURES).filter(semver.valid);
  const compatible = allVersions.filter((v) => semver.lte(v, version)).sort(semver.rcompare);

  return compatible[0] || getLatestVersion();
}

export const featureEnabled = (featureKey, serverVersion) => {
  const minSupportedVersion = '1.3.0';

  const version = getVersion(serverVersion);

  if (semver.lt(version.replace('v', ''), minSupportedVersion)) {
    // eslint-disable-next-line no-console
    console.error(`Harvester UI extension only supports Harvester cluster version >= ${ minSupportedVersion }. Current version: ${ version }`);

    return false;
  }

  const compatibleVersion = getLatestCompatibleVersion(version);
  const releasedFeatures = RELEASE_FEATURES?.[compatibleVersion];

  if (!Array.isArray(releasedFeatures)) {
    // eslint-disable-next-line no-console
    console.error(
      `Feature flags for version ${ version } are not defined. Please upgrade Harvester UI extension and check the support matrix.`
    );

    return false;
  }

  return releasedFeatures.includes(featureKey);
};
