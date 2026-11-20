import { buildStorageMapEntries, storageProfileDefaults } from '../forklift';

const profile = (claimPropertySets) => ({ status: { claimPropertySets } });

describe('storageProfileDefaults', () => {
  it('should prefer a ReadWriteMany set so the migrated VM stays live-migratable', () => {
    // ceph-rbd: RWX is only supported with Block
    const cephRbd = profile([
      { volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'] },
      { volumeMode: 'Block', accessModes: ['ReadWriteOnce', 'ReadWriteMany'] },
    ]);

    expect(storageProfileDefaults(cephRbd)).toStrictEqual({ volumeMode: 'Block', accessModes: ['ReadWriteMany'] });
  });

  it('should take the first set when no set offers ReadWriteMany', () => {
    // longhorn-static
    const longhornStatic = profile([{ volumeMode: 'Block', accessModes: ['ReadWriteOnce'] }]);

    expect(storageProfileDefaults(longhornStatic)).toStrictEqual({ volumeMode: 'Block', accessModes: ['ReadWriteOnce'] });
  });

  it('should keep Filesystem for a class whose profile advertises it', () => {
    // netapp-nfs (Trident)
    const netappNfs = profile([{ volumeMode: 'Filesystem', accessModes: ['ReadWriteMany'] }]);

    expect(storageProfileDefaults(netappNfs)).toStrictEqual({ volumeMode: 'Filesystem', accessModes: ['ReadWriteMany'] });
  });

  it('should skip incomplete sets', () => {
    const value = profile([
      { volumeMode: 'Block', accessModes: [] },
      { accessModes: ['ReadWriteMany'] },
      { volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'] },
    ]);

    expect(storageProfileDefaults(value)).toStrictEqual({ volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'] });
  });

  it.each([
    ['no profile', undefined],
    ['a profile without status', {}],
    ['a profile without claimPropertySets', profile([])],
    ['a profile with only incomplete sets', profile([{ volumeMode: 'Block' }])],
  ])('should return null for %s', (_label, value) => {
    expect(storageProfileDefaults(value)).toBeNull();
  });
});

describe('buildStorageMapEntries', () => {
  it('should write the volume mode and the first access mode into the StorageMap destination', () => {
    const entries = [
      {
        id: 'ds-1', name: 'datastore1', target: 'ceph-rbd', volumeMode: 'Block', accessModes: ['ReadWriteMany']
      },
      {
        id: 'ds-2', name: 'datastore2', target: ''
      },
    ];

    expect(buildStorageMapEntries(entries)).toStrictEqual([{
      source:      { name: 'datastore1', id: 'ds-1' },
      destination: {
        storageClass: 'ceph-rbd', volumeMode: 'Block', accessMode: 'ReadWriteMany'
      },
    }]);
  });
});
