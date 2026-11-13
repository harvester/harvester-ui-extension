import { shallowMount } from '@vue/test-utils';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import MappingColumn from '../MappingColumn.vue';

const mockStore = { getters: { 'i18n/t': (key) => key, 'i18n/exists': () => true } };

jest.mock('vuex', () => ({
  ...jest.requireActual('vuex'),
  useStore: () => mockStore,
}));

function mountColumn(entries) {
  return shallowMount(MappingColumn, {
    props:  {
      title: 'Storage', entries, options: [{ label: 'ceph-rbd', value: 'ceph-rbd' }], showVolumeSettings: true
    },
    global: { stubs: { RcItemCard: { template: '<div><slot name="item-card-content" /></div>' } } },
  });
}

describe('component: MappingColumn', () => {
  it('should set the target and emit target-change when a StorageClass is picked', async() => {
    const entry = {
      _key: 'ds-1', name: 'datastore1', target: ''
    };
    const wrapper = mountColumn([entry]);

    wrapper.findComponent(LabeledSelect).vm.$emit('update:value', 'ceph-rbd');
    await wrapper.vm.$nextTick();

    expect(entry.target).toBe('ceph-rbd');
    expect(wrapper.emitted('target-change')).toStrictEqual([[entry]]);
  });
});
