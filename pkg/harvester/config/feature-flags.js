import semver from 'semver';

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
    'upgradeConfigSetting'
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
    'thirdPartyStorage',
    'liveMigrationProgress'
  ],
  'v1.5.1': [],
  'v1.6.0': [
    'customSupportBundle',
    'csiOnlineExpandValidation',
    'vmNetworkMigration',
    'kubeovnVpcSubnet',
    'rancherClusterSetting',
    'cpuMemoryHotplug',
    'cdiSettings',
    'vmCloneRunStrategy',
  ],
  'v1.6.1': [],
  'v1.7.0': [
    'vmMachineTypeAuto'
  ]
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
