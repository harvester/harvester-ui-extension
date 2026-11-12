import UpgradeRepositoryStorageClass from '../UpgradeRepositoryStorageClass.vue';

const storageClasses = [
  { name: 'fast', isDefault: true },
  { name: 'image-cache', parameters: { backingImage: 'image' } },
  { name: 'lvm-local', provisioner: 'lvm.driver.harvesterhci.io' },
  { name: 'longhorn-static' },
  { name: 'slow' }
];

describe('component: UpgradeRepositoryStorageClass', () => {
  it('omits backing-image and LVM StorageClasses while disabling internal classes', () => {
    const form = {
      storageClasses,
      $store: { getters: { 'i18n/t': (key) => key } }
    };

    expect(UpgradeRepositoryStorageClass.computed.storageClassOptions.call(form)).toStrictEqual([
      {
        label: 'fast (generic.default)', value: 'fast', disabled: false
      },
      {
        label: 'longhorn-static (harvester.storage.internal.label)', value: 'longhorn-static', disabled: true
      },
      {
        label: 'slow', value: 'slow', disabled: false
      },
    ]);
  });
});
