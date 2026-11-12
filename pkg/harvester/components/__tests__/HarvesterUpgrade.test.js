import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import HarvesterUpgrade from '../HarvesterUpgrade.vue';

const save = jest.fn().mockResolvedValue();
const upgrade = { notifyGeneratedName: jest.fn(), save };

function createForm(storageClassName = '', repositoryStorageClassEnabled = true) {
  return {
    version:                                    'v1.10.0',
    storageClassName,
    repositoryStorageClassEnabled,
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
  it('uses the shared Upgrade Repository StorageClass selector', () => {
    expect(HarvesterUpgrade.components.UpgradeRepositoryStorageClass).toBeDefined();
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

  it('omits the repository StorageClass when the feature is disabled', async() => {
    const form = createForm('fast', false);

    await HarvesterUpgrade.methods.handleUpgrade.call(form);

    expect(form.$store.dispatch).toHaveBeenCalledWith('harvester/create', {
      type:     'harvesterhci.io.upgrade',
      metadata: {
        generateName: 'hvst-upgrade-',
        namespace:    'harvester-system'
      },
      spec: { version: 'v1.10.0' }
    });
  });
});
