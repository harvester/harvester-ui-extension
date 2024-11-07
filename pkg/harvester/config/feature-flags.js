
// https://github.com/harvester/harvester/wiki/Roadmap
const FEATURES = {
  cpuPinning:                                     false,
  usbPassthrough:                                 false,
  volumeEncryption:                               false,
  schedulingVMBackup:                             false,
  vmSnapshotQuota:                                false,
  longhornV2LVMSupport:                           false,
  improveMaintainMode:                            false,
  autoRotateRke2CertsSetting:                     false,
  kubeconfigDefaultTokenTTLMinutesSetting:        false,
  supportBundleNodeCollectionTimeoutSetting:      false
};

// https://github.com/harvester/dashboard/releases/tag/v1.3.0
const releaseV130 = { ...FEATURES };

// https://github.com/harvester/dashboard/releases/tag/v1.3.1
const releaseV131 = {
  ...releaseV130,
  autoRotateRke2CertsSetting:                 true,
  supportBundleNodeCollectionTimeoutSetting:  true
};

// https://github.com/harvester/dashboard/releases/tag/v1.3.2
const releaseV132 = {
  ...releaseV131,
  kubeconfigDefaultTokenTTLMinutesSetting: true,
};

// TODO: change to https://github.com/harvester/dashboard/releases/tag/v1.4.0 after v1.4.0 release
// https://github.com/harvester/dashboard/releases/tag/v1.4.0-rc5
// https://github.com/harvester/dashboard/releases/tag/v1.4.0-rc4
// https://github.com/harvester/dashboard/releases/tag/v1.4.0-rc3
// https://github.com/harvester/dashboard/releases/tag/v1.4.0-rc2
// https://github.com/harvester/dashboard/releases/tag/v1.4.0-rc1
const releaseV140 = {
  ...releaseV132,
  cpuPinning:                                    true,
  usbPassthrough:                                true,
  volumeEncryption:                              true,
  schedulingVMBackup:                            true,
  vmSnapshotQuota:                               true,
  longhornV2LVMSupport:                          true,
  improveMaintainMode:                           true,
};

export const RELEASE_FEATURES = {
  'v1.4.0': releaseV140,
  'v1.3.2': releaseV132,
  'v1.3.1': releaseV132,
  'v1.3.0': releaseV130,
};
