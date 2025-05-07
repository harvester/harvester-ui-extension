// https://github.com/harvester/dashboard/releases/tag/v1.3.0
const featuresV130 = [
  'supportHarvesterClusterVersion'
];

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

// https://github.com/harvester/dashboard/releases/tag/v1.4.2
const featuresV142 = [
  ...featuresV141,
  'refreshIntervalInSecond',
  'allowEmptySnapshotClassName'
];

// TODO: https://github.com/harvester/dashboard/releases/tag/v1.4.3
const featuresV143 = [
  ...featuresV142,
];

// https://github.com/harvester/harvester-ui-extension/releases/tag/v1.5.0
const featuresV150 = [
  ...featuresV143,
  'tpmPersistentState',
  'efiPersistentState',
  'untaggedNetworkSetting',
  'skipSingleReplicaDetachedVol',
  'thirdPartyStorage'
];

// TODO: https://github.com/harvester/harvester-ui-extension/releases/tag/v1.5.1
const featuresV151 = [
  ...featuresV150
];

// TODO: https://github.com/harvester/harvester-ui-extension/releases/tag/v1.6.0
const featuresV160 = [
  ...featuresV151
];

export const RELEASE_FEATURES = {
  'v1.3.0': featuresV130,
  'v1.3.1': featuresV131,
  'v1.3.2': featuresV132,
  'v1.3.3': featuresV133,
  'v1.4.0': featuresV140,
  'v1.4.1': featuresV141,
  'v1.4.2': featuresV142,
  'v1.4.3': featuresV143,
  'v1.5.0': featuresV150,
  'v1.5.1': featuresV151,
  'v1.6.0': featuresV160
};
