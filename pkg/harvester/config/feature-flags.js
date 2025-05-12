import semver from 'semver';

<<<<<<< HEAD
// https://github.com/harvester/dashboard/releases/tag/v1.3.1
const featuresV131 = [
  ...featuresV130,
  'autoRotateRke2CertsSetting',
  'supportBundleNodeCollectionTimeoutSetting'
];

// https://github.com/harvester/dashboard/releases/tag/v1.3.2
const featuresV132 = [
  ...featuresV131,
  'kubeconfigDefaultTokenTTLMinutesSetting',
  'improveMaintenanceMode',
];

// TODO: add v1.3.3 official release note
// https://github.com/harvester/dashboard/releases/tag/v1.3.3-dev-20250105
const featuresV133 = [
  ...featuresV132,
];

// https://github.com/harvester/dashboard/releases/tag/v1.4.0
const featuresV140 = [
  ...featuresV133,
  'cpuPinning',
  'usbPassthrough',
  'volumeEncryption',
  'schedulingVMBackup',
  'vmSnapshotQuota',
  'longhornV2LVMSupport',
  'improveMaintenanceMode',
];

// https://github.com/harvester/dashboard/releases/tag/v1.4.1
const featuresV141 = [
  ...featuresV140
];

// TODO: add v1.4.2 official release note
const featuresV142 = [
  ...featuresV141,
  'refreshIntervalInSecond',
  'allowEmptySnapshotClassName'
];

// TODO: add v1.5.0 official release note
const featuresV150 = [
  ...featuresV142,
  'tpmPersistentState',
  'efiPersistentState',
  'untaggedNetworkSetting',
  'skipSingleReplicaDetachedVol',
  'thirdPartyStorage'
];

export const RELEASE_FEATURES = {
  'v1.3.0': featuresV130,
  'v1.3.1': featuresV131,
  'v1.3.2': featuresV132,
  'v1.3.3': featuresV133,
  'v1.4.0': featuresV140,
  'v1.4.1': featuresV141,
  'v1.4.2': featuresV142,
  'v1.5.0': featuresV150
=======
const FEATURE_FLAGS = {
  'v1.3.0': [
    'supportHarvesterClusterVersion'
  ],
  'v1.3.1': [
    'autoRotateRke2CertsSetting',
    'supportBundleNodeCollectionTimeoutSetting'
  ],
  'v1.3.2': [
    'kubeconfigDefaultTokenTTLMinutesSetting',
    'improveMaintenanceMode',
  ],
  'v1.3.3': [],
  'v1.4.0': [
    'cpuPinning',
    'usbPassthrough',
    'volumeEncryption',
    'schedulingVMBackup',
    'vmSnapshotQuota',
    'longhornV2LVMSupport',
    'improveMaintenanceMode',
  ],
  'v1.4.1': [],
  'v1.4.2': [
    'refreshIntervalInSecond',
    'allowEmptySnapshotClassName'
  ],
  'v1.4.3': [],
  'v1.5.0': [
    'tpmPersistentState',
    'efiPersistentState',
    'untaggedNetworkSetting',
    'skipSingleReplicaDetachedVol',
    'thirdPartyStorage'
  ],
  'v1.5.1': [],
  'v1.6.0': []
>>>>>>> f8079c5 (Refactor feature flags structure (#276))
};

const generateFeatureFlags = () => {
  const versions = [...Object.keys(FEATURE_FLAGS)].filter((version) => semver.valid(version)).sort(semver.compare);

  const generatedFlags = {};

  versions.forEach((version, index) => {
    const previousVersion = versions[index - 1];

    generatedFlags[version] = previousVersion ? [...generatedFlags[previousVersion], ...FEATURE_FLAGS[version]] : [...FEATURE_FLAGS[version]];
  });

  return generatedFlags;
};

export const RELEASE_FEATURES = generateFeatureFlags();
