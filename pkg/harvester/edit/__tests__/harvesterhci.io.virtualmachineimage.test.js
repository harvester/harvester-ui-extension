import EditImage from '../harvesterhci.io.virtualmachineimage.vue';

function storageClass(name, options = {}) {
  return {
    name,
    metadata: { name },
    ...options,
  };
}

function defaultStorageClassName(storageClasses) {
  return EditImage.methods.defaultStorageClassName.call({ selectableStorageClasses: selectableStorageClasses(storageClasses) });
}

function selectableStorageClasses(storageClasses) {
  const availableStorageClasses = EditImage.computed.availableStorageClasses.call({
    value: {
      spec:                            { thirdPartyStorageFeatureEnabled: true },
      thirdPartyStorageFeatureEnabled: true,
    },
    encryptedStorageClasses:    [],
    nonEncryptedStorageClasses: storageClasses,
  });

  return EditImage.computed.selectableStorageClasses.call({ availableStorageClasses });
}

describe('component: EditImage', () => {
  it('leaves the storage class empty when none are selectable', () => {
    expect(defaultStorageClassName([])).toBe('');
  });

  it('selects longhorn before the cluster default storage class', () => {
    expect(defaultStorageClassName([
      storageClass('fast', { isDefault: true }),
      storageClass('longhorn'),
    ])).toBe('longhorn');
  });

  it('selects the cluster default storage class when longhorn is unavailable', () => {
    expect(defaultStorageClassName([
      storageClass('slow'),
      storageClass('fast', { isDefault: true }),
    ])).toBe('fast');
  });

  it('selects the first selectable storage class when no preferred class is available', () => {
    expect(defaultStorageClassName([
      storageClass('backing-image', { parameters: { backingImage: 'image' } }),
      storageClass('fast'),
      storageClass('slow'),
    ])).toBe('fast');
  });

  it('does not include a backing-image longhorn class among selectable classes', () => {
    expect(selectableStorageClasses([
      storageClass('longhorn', { parameters: { backingImage: 'image' } }),
      storageClass('fast'),
    ]).map((storageClass) => storageClass.name)).toStrictEqual(['fast']);
  });

  it('waits for storage classes before showing the unavailable banner', () => {
    const showBanner = EditImage.computed.showStorageClassUnavailableBanner;

    expect(showBanner.call({
      mode: 'create', storageClassesLoaded: false, selectableStorageClasses: []
    })).toBe(false);
    expect(showBanner.call({
      mode: 'create', storageClassesLoaded: true, selectableStorageClasses: []
    })).toBe(true);
    expect(showBanner.call({
      mode: 'view', storageClassesLoaded: true, selectableStorageClasses: []
    })).toBe(false);
  });
});
