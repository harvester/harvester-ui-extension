import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import HarvesterAirgapUpgrade from '../index.vue';

function createForm(overrides = {}) {
  const image = {
    metadata: { annotations: {} },
    spec:     {
      displayName: 'upgrade.iso',
      url:         'https://example.com/upgrade.iso',
    },
    save: jest.fn(),
  };
  const imageResult = {
    id:                  'harvester-system/upgrade-image',
    notifyGeneratedName: jest.fn(),
    uploadImage:         jest.fn().mockResolvedValue({}),
  };

  image.save.mockResolvedValue(imageResult);

  return {
    imageSource:                                'new',
    sourceType:                                 'upload',
    storageClassName:                           'fast',
    repositoryStorageClassEnabled:              true,
    uploadImageId:                              '',
    imageId:                                    '',
    imageValue:                                 image,
    value:                                      {
      metadata: { annotations: {} }, spec: {}, save: jest.fn().mockResolvedValue(), notifyGeneratedName: jest.fn()
    },
    canEnableLogging:                           false,
    skipSingleReplicaDetachedVolFeatureEnabled: false,
    skipSingleReplicaDetachedVol:               false,
    allOSImages:                                [],
    errors:                                     [],
    file:                                       {},
    done:                                       jest.fn(),
    preprocessImageName:                        HarvesterAirgapUpgrade.methods.preprocessImageName,
    $store:                                     { getters: { 'i18n/t': (key) => key } },
    ...overrides,
  };
}

describe('page: HarvesterAirgapUpgrade', () => {
  it('uses the shared Upgrade Repository StorageClass selector', () => {
    expect(HarvesterAirgapUpgrade.components.UpgradeRepositoryStorageClass).toBeDefined();
  });

  it('saves an uploaded upgrade image on the selected StorageClass', async() => {
    const form = createForm();

    await HarvesterAirgapUpgrade.methods.uploadFile.call(form, { name: 'upgrade.iso' });

    expect(form.imageValue.spec.targetStorageClassName).toBe('fast');
  });

  it('saves a downloaded upgrade image on the selected StorageClass', async() => {
    const form = createForm({ sourceType: 'download' });

    await HarvesterAirgapUpgrade.methods.save.call(form, jest.fn());

    expect(form.imageValue.spec.targetStorageClassName).toBe('fast');
  });

  it('keeps the legacy StorageClass when the feature is disabled', async() => {
    const form = createForm({ repositoryStorageClassEnabled: false });

    await HarvesterAirgapUpgrade.methods.uploadFile.call(form, { name: 'upgrade.iso' });

    expect(form.imageValue.spec.targetStorageClassName).toBe('longhorn-static');
  });

  it('does not change the StorageClass of an existing image', async() => {
    const form = createForm({
      imageSource: 'exist',
      imageId:     'harvester-system/existing-image',
    });

    form.imageValue.spec.targetStorageClassName = 'existing-class';
    await HarvesterAirgapUpgrade.methods.save.call(form, jest.fn());

    expect(form.imageValue.spec.targetStorageClassName).toBe('existing-class');
  });

  it('omits the Upgrade StorageClass annotation when the feature is disabled', async() => {
    const form = createForm({
      imageSource:                   'exist',
      imageId:                       'harvester-system/existing-image',
      repositoryStorageClassEnabled: false,
    });

    await HarvesterAirgapUpgrade.methods.save.call(form, jest.fn());

    expect(form.value.metadata.annotations[HCI_ANNOTATIONS.UPGRADE_STORAGE_CLASS]).toBeUndefined();
  });
});
