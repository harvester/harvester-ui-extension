import { shallowMount } from '@vue/test-utils';
import StorageDefaultsModal from '../StorageDefaultsModal.vue';

const mockStore = { getters: { 'i18n/t': (key) => key, 'i18n/exists': () => true } };

jest.mock('vuex', () => ({
  ...jest.requireActual('vuex'),
  useStore: () => mockStore,
}));

function mountModal(props) {
  return shallowMount(StorageDefaultsModal, {
    props:  { storageClassName: 'ceph-rbd', ...props },
    global: {
      stubs: {
        'app-modal': { template: '<div><slot /></div>' },
        Card:        { template: '<div><slot name="body" /><slot name="actions" /></div>' },
      },
    },
  });
}

const applyButton = (wrapper) => wrapper.find('.btn.role-primary');

describe('component: StorageDefaultsModal', () => {
  it('should apply Block / ReadWriteMany when no modes are given', async() => {
    const wrapper = mountModal();

    await applyButton(wrapper).trigger('click');

    expect(wrapper.emitted('apply')).toStrictEqual([[{ volumeMode: 'Block', accessModes: ['ReadWriteMany'] }]]);
  });

  it('should apply the modes of the entry', async() => {
    const wrapper = mountModal({ volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'] });

    await applyButton(wrapper).trigger('click');

    expect(wrapper.emitted('apply')).toStrictEqual([[{ volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'] }]]);
  });

  it('should reset to the StorageClass defaults', async() => {
    const wrapper = mountModal({
      showInherited:        true,
      volumeMode:           'Filesystem',
      accessModes:          ['ReadWriteMany'],
      inheritedVolumeMode:  'Block',
      inheritedAccessModes: ['ReadWriteOnce'],
    });

    await wrapper.find('.right-buttons .btn.role-secondary').trigger('click');
    await applyButton(wrapper).trigger('click');

    expect(wrapper.emitted('apply')).toStrictEqual([[{ volumeMode: 'Block', accessModes: ['ReadWriteOnce'] }]]);
  });
});
