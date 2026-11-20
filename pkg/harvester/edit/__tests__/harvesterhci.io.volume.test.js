import HarvesterVolume from '../harvesterhci.io.volume.vue';

async function fetchStorageClass(storageClasses, storageClassName) {
  const context = {
    value:     { spec: {} },
    snapshots: [],
    images:    [],
    $store:    {
      getters: {
        currentProduct:        { inStore: 'harvester' },
        'harvester/schemaFor': () => false,
        'harvester/all':       () => storageClasses,
      },
      dispatch: () => Promise.resolve([]),
    },
  };

  if (storageClassName) {
    context.value.spec.storageClassName = storageClassName;
  }

  await HarvesterVolume.fetch.call(context);

  return context;
}

function storageClass(name, options = {}) {
  return {
    name,
    metadata: { name },
    ...options,
  };
}

describe('component: HarvesterVolume', () => {
  it('leaves the storage class unselected when the cluster has no selectable class', async() => {
    const context = await fetchStorageClass([]);

    expect(context.value.spec.storageClassName).toBeUndefined();
  });

  it('selects longhorn before the cluster default storage class', async() => {
    const context = await fetchStorageClass([
      storageClass('fast', { isDefault: true }),
      storageClass('longhorn'),
    ]);

    expect(context.value.spec.storageClassName).toBe('longhorn');
  });

  it('selects the cluster default storage class when longhorn is unavailable', async() => {
    const context = await fetchStorageClass([
      storageClass('slow'),
      storageClass('fast', { isDefault: true }),
    ]);

    expect(context.value.spec.storageClassName).toBe('fast');
  });

  it('selects the first selectable storage class when no preferred class is available', async() => {
    const context = await fetchStorageClass([
      storageClass('backing-image', { parameters: { backingImage: 'image' } }),
      storageClass('fast'),
      storageClass('slow'),
    ]);

    expect(context.value.spec.storageClassName).toBe('fast');
  });

  it('does not select a backing-image longhorn class', async() => {
    const context = await fetchStorageClass([
      storageClass('longhorn', { parameters: { backingImage: 'image' } }),
      storageClass('fast'),
    ]);

    expect(context.value.spec.storageClassName).toBe('fast');
  });

  it('preserves an existing storage class', async() => {
    const context = await fetchStorageClass([storageClass('fast', { isDefault: true })], 'existing');

    expect(context.value.spec.storageClassName).toBe('existing');
  });

  it('waits for storage classes before showing the unavailable banner', () => {
    const showBanner = HarvesterVolume.computed.showStorageClassUnavailableBanner;

    expect(showBanner.call({
      mode: 'create', storageClassesLoaded: false, selectableStorageClasses: [], isBlank: true
    })).toBe(false);
    expect(showBanner.call({
      mode: 'create', storageClassesLoaded: true, selectableStorageClasses: [], isBlank: true
    })).toBe(true);
    expect(showBanner.call({
      mode: 'create', storageClassesLoaded: true, selectableStorageClasses: [], isBlank: false
    })).toBe(false);
    expect(showBanner.call({
      mode: 'view', storageClassesLoaded: true, selectableStorageClasses: [], isBlank: true
    })).toBe(false);
  });
});
