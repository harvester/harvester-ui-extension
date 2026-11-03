import { shallowMount, flushPromises } from '@vue/test-utils';
import MappingColumn from '../MappingColumn.vue';
import ConfigureMappingsStep from '../ConfigureMappingsStep.vue';

const STORAGE_PROFILE = 'cdi.kubevirt.io.storageprofile';
const STORAGE_MAP = 'forklift.konveyor.io.storagemap';

const profile = (name, claimPropertySets) => ({ metadata: { name }, status: { claimPropertySets } });

const storageProfiles = [
  profile('ceph-rbd', [
    { volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'] },
    { volumeMode: 'Block', accessModes: ['ReadWriteMany'] },
  ]),
  profile('longhorn-static', [{ volumeMode: 'Block', accessModes: ['ReadWriteOnce'] }]),
  profile('netapp-nfs', [{ volumeMode: 'Filesystem', accessModes: ['ReadWriteMany'] }]),
];

let storageMaps = [];

const mockStore = {
  getters: {
    currentProduct:                            { inStore: 'harvester' },
    'harvester/all':                           () => [],
    'harvester-common/getHarvesterClusterUrl': (url) => url,
    'i18n/t':                                  (key) => key,
    'i18n/exists':                             () => true,
  },
  dispatch: jest.fn((action, payload) => {
    if (action === 'harvester/findAll') {
      if (payload.type === STORAGE_PROFILE) {
        return Promise.resolve(storageProfiles);
      }
      if (payload.type === STORAGE_MAP) {
        return Promise.resolve(storageMaps);
      }
    }

    return Promise.resolve([]);
  }),
};

jest.mock('vuex', () => ({
  ...jest.requireActual('vuex'),
  useStore: () => mockStore,
}));

const defaultStorageMap = (destination) => ({
  metadata: { name: 'vsphere-storage-map-default' },
  spec:     { map: [{ source: { id: 'ds-1' }, destination }] },
});

async function mountStep(providerStorageMaps = []) {
  storageMaps = providerStorageMaps;
  const stepData = {
    networkEntries: [{
      _key: 'net-1', id: 'net-1', name: 'VM Network', target: 'pod'
    }],
    storageEntries: [{
      _key: 'ds-1', id: 'ds-1', name: 'datastore1', target: ''
    }],
  };
  const wrapper = shallowMount(ConfigureMappingsStep, { props: { providerName: 'vsphere', stepData } });

  await flushPromises();

  return { wrapper, entry: stepData.storageEntries[0] };
}

const storageColumn = (wrapper) => wrapper.findAllComponents(MappingColumn).find((c) => c.props('showVolumeSettings'));

async function pickStorageClass(wrapper, entry, name) {
  entry.target = name;
  storageColumn(wrapper).vm.$emit('target-change', entry);
  await flushPromises();
}

describe('component: ConfigureMappingsStep', () => {
  it.each([
    ['ceph-rbd', 'Block', ['ReadWriteMany']],
    ['longhorn-static', 'Block', ['ReadWriteOnce']],
    ['netapp-nfs', 'Filesystem', ['ReadWriteMany']],
  ])('should take the modes for %s from its StorageProfile', async(name, volumeMode, accessModes) => {
    const { wrapper, entry } = await mountStep();

    await pickStorageClass(wrapper, entry, name);

    expect(entry.volumeMode).toBe(volumeMode);
    expect(entry.accessModes).toStrictEqual(accessModes);
    expect(entry.inheritedVolumeMode).toBe(volumeMode);
    expect(entry.inheritedAccessModes).toStrictEqual(accessModes);
  });

  it('should fall back to Block / ReadWriteMany for a StorageClass without a StorageProfile', async() => {
    const { wrapper, entry } = await mountStep();

    await pickStorageClass(wrapper, entry, 'no-profile');

    expect(entry.volumeMode).toBe('Block');
    expect(entry.accessModes).toStrictEqual(['ReadWriteMany']);
  });

  it('should re-apply the defaults and clear the override when another StorageClass is picked', async() => {
    const { wrapper, entry } = await mountStep();

    await pickStorageClass(wrapper, entry, 'netapp-nfs');
    entry.overridden = true;
    entry.inheritedFromProvider = true;

    await pickStorageClass(wrapper, entry, 'longhorn-static');

    expect(entry.volumeMode).toBe('Block');
    expect(entry.accessModes).toStrictEqual(['ReadWriteOnce']);
    expect(entry.overridden).toBe(false);
    expect(entry.inheritedFromProvider).toBe(false);
  });

  it('should take the profile defaults for a provider default map without modes', async() => {
    const { entry } = await mountStep([defaultStorageMap({ storageClass: 'ceph-rbd' })]);

    expect(entry.target).toBe('ceph-rbd');
    expect(entry.volumeMode).toBe('Block');
    expect(entry.accessModes).toStrictEqual(['ReadWriteMany']);
    expect(entry.inheritedFromProvider).toBe(true);
  });

  it('should keep the modes of the provider default map over the profile defaults', async() => {
    const { entry } = await mountStep([defaultStorageMap({
      storageClass: 'ceph-rbd', volumeMode: 'Filesystem', accessMode: 'ReadWriteOnce'
    })]);

    expect(entry.volumeMode).toBe('Filesystem');
    expect(entry.accessModes).toStrictEqual(['ReadWriteOnce']);
    expect(entry.inheritedVolumeMode).toBe('Filesystem');
    expect(entry.inheritedAccessModes).toStrictEqual(['ReadWriteOnce']);
  });
});
