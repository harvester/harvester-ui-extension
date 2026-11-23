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

async function fetchStorageClass(storageClasses, storageClassName, isCreate = true) {
  const context = {
    isCreate,
    storageClassName,
    selectableStorageClasses: storageClasses,
    images:                   [],
    storages:                 [],
    value:                    { spec: {} },
    $store:                   {
      getters: {
        currentProduct:        { inStore: 'harvester' },
        'harvester/all':       () => storageClasses,
      },
      dispatch: () => Promise.resolve([]),
    },
    defaultStorageClassName() {
      return EditImage.methods.defaultStorageClassName.call(this);
    },
  };

  await EditImage.fetch.call(context);

  return context;
}

describe('component: EditImage', () => {
  it('leaves the storage class empty when none are selectable', () => {
    expect(defaultStorageClassName([])).toBe('');
  });

  it('selects the cluster default storage class before longhorn', () => {
    expect(defaultStorageClassName([
      storageClass('fast', { isDefault: true }),
      storageClass('longhorn'),
    ])).toBe('fast');
  });

  it('selects longhorn when the cluster default storage class is unavailable', () => {
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

  it('falls back when the annotated storage class is unavailable during creation', async() => {
    const context = await fetchStorageClass([storageClass('fast')], 'missing');

    expect(context.storageClassName).toBe('fast');
  });

  it('preserves an unavailable annotated storage class when editing', async() => {
    const context = await fetchStorageClass([storageClass('fast')], 'missing', false);

    expect(context.storageClassName).toBe('missing');
  });

  it('uses encryption-specific guidance when no encrypted storage class is selectable', () => {
    const storageClassUnavailableMessage = EditImage.computed.storageClassUnavailableMessage;

    expect(storageClassUnavailableMessage.call({ value: { spec: { securityParameters: { cryptoOperation: 'encrypt' } } } })).toBe('harvester.image.encryptedStorageClassUnavailable');
    expect(storageClassUnavailableMessage.call({ value: { spec: {} } })).toBe('harvester.image.storageClassUnavailable');
  });

  it('waits for storage classes before showing the unavailable banner', () => {
    const showBanner = EditImage.computed.showStorageClassUnavailableBanner;

    expect(showBanner.call({
      mode: 'create', isCreate: true, storageClassesLoaded: false, selectableStorageClasses: []
    })).toBe(false);
    expect(showBanner.call({
      mode: 'create', isCreate: true, storageClassesLoaded: true, selectableStorageClasses: []
    })).toBe(true);
    expect(showBanner.call({
      mode: 'view', isCreate: false, storageClassesLoaded: true, selectableStorageClasses: []
    })).toBe(false);
    expect(showBanner.call({
      mode: 'edit', isCreate: false, storageClassesLoaded: true, selectableStorageClasses: []
    })).toBe(false);
  });
});
