import { STORAGE_CLASS } from '@shell/config/types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import HarvesterUpgrade from '../HarvesterUpgrade.vue';

const save = jest.fn().mockResolvedValue();
const upgrade = { notifyGeneratedName: jest.fn(), save };

function createForm(storageClassName = '') {
  return {
    version:                                    'v1.10.0',
    storageClassName,
    canEnableLogging:                           false,
    enableLogging:                              true,
    skipSingleReplicaDetachedVolFeatureEnabled: false,
    skipSingleReplicaDetachedVol:               false,
    cancel:                                     jest.fn(),
    errors:                                     '',
    $store:                                     { dispatch: jest.fn().mockResolvedValue(upgrade) }
  };
}

describe('component: HarvesterUpgrade', () => {
  it('lists every StorageClass and identifies the default', () => {
    const storageClasses = [{ name: 'fast', isDefault: true }, { name: 'slow' }];
    const form = {
      storageClasses,
      $store: {
        getters: {
          'i18n/t':        (key) => key,
          currentProduct:    { inStore: 'harvester' },
          'harvester/all': (type) => type === STORAGE_CLASS ? storageClasses : []
        }
      }
    };

    expect(HarvesterUpgrade.computed.defaultStorageClassName.call(form)).toBe('fast');
    expect(HarvesterUpgrade.computed.storageClassOptions.call(form)).toStrictEqual([
      { label: 'fast (generic.default)', value: 'fast' },
      { label: 'slow', value: 'slow' },
    ]);
  });

  it('blocks the upgrade when no StorageClass is selected', () => {
    const canSubmitUpgrade = HarvesterUpgrade.computed.canSubmitUpgrade;

    expect(canSubmitUpgrade.call({
      readyReleaseNote:              true,
      repositoryStorageClassEnabled: true,
      storageClassName:              ''
    })).toBe(false);
  });

  it('saves the selected StorageClass as an Upgrade annotation', async() => {
    const form = createForm('fast');

    await HarvesterUpgrade.methods.handleUpgrade.call(form);

    expect(form.$store.dispatch).toHaveBeenCalledWith('harvester/create', expect.objectContaining({
      metadata: expect.objectContaining({ annotations: { [HCI_ANNOTATIONS.UPGRADE_STORAGE_CLASS]: 'fast' } }),
      spec:     { version: 'v1.10.0' }
    }));
  });

  it('omits the repository StorageClass when left blank', async() => {
    const form = createForm();

    await HarvesterUpgrade.methods.handleUpgrade.call(form);

    expect(form.$store.dispatch).toHaveBeenCalledWith('harvester/create', expect.objectContaining({ spec: { version: 'v1.10.0' } }));
  });
});
