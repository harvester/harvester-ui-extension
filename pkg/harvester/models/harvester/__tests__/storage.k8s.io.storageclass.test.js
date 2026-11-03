import HciStorageClass, { LVM_DRIVER } from '../storage.k8s.io.storageclass';

jest.mock('@shell/models/storage.k8s.io.storageclass', () => ({ __esModule: true, default: class {} }));
jest.mock('../persistentvolumeclaim', () => ({ DATA_ENGINE_V1: 'v1', DATA_ENGINE_V2: 'v2' }));

// A StorageClass model on a cluster with the given feature flags
function storageClass(parameters, features = []) {
  const sc = Object.create(HciStorageClass.prototype);

  Object.assign(sc, { provisioner: LVM_DRIVER, parameters });
  Object.defineProperty(sc, '$rootGetters', { value: { 'harvester-common/getFeatureEnabled': (flag) => features.includes(flag) } });

  return sc;
}

describe('class HciStorageClass LVM encryption', () => {
  it('should gate LVM encryption on its own feature flag, not on the Longhorn one', () => {
    expect(storageClass({}, ['lvmVolumeEncryption']).lvmVolumeEncryptionFeatureEnabled).toBe(true);
    expect(storageClass({}, ['volumeEncryption']).lvmVolumeEncryptionFeatureEnabled).toBe(false);
  });

  it('should report an encrypted LVM StorageClass as encrypted', () => {
    expect(storageClass({ encrypted: 'true' }).isEncrypted).toBe(true);
    expect(storageClass({ encrypted: 'false' }).isEncrypted).toBe(false);
  });
});
