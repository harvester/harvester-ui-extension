import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
import VirtualMachineNetwork from '../index.vue';

describe('component: VirtualMachineNetwork', () => {
  const BANNER = '[data-testid="banner-live-network-change"]';
  const nad = (id) => ({
    id, metadata: { annotations: {} }, parseConfig: { type: 'bridge' }
  });
  const store = {
    getters: {
      'harvester-common/getFeatureEnabled': () => true,
      'harvester/all':                      () => [nad('default/vlan-100'), nad('default/vlan-200')],
      'i18n/t':                             jest.fn(),
    }
  };
  const nic = (name, networkName) => ({
    name, networkName, model: 'virtio', type: 'bridge'
  });

  it('should not show the live network change banner on the next NIC after a NIC is removed', async() => {
    const wrapper = mount(VirtualMachineNetwork, {
      props: {
        mode:                _EDIT,
        canLiveUpdateNADRef: true,
        value:               [nic('nic-a', 'default/vlan-100'), nic('nic-b', 'default/vlan-200')],
      },
      global: { mocks: { $store: store } },
    });

    expect(wrapper.find(BANNER).exists()).toBe(false);

    await wrapper.find('button.remove').trigger('click');
    await wrapper.setProps({ value: wrapper.emitted('update:value')?.[0]?.[0] });

    expect(wrapper.findAll('[data-testid="input-hen-name"]')).toHaveLength(1);
    expect(wrapper.find(BANNER).exists()).toBe(false);
  });
});
