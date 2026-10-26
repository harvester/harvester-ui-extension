import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
import HarvesterEditNetwork from '../base.vue';

describe('component: HarvesterEditNetwork', () => {
  // eslint-disable-next-line jest/no-commented-out-tests
  // it('should display all the inputs', () => {
  //   const wrapper = mount(HarvesterEditNetwork, { propsData: { mode: _EDIT } });

  //   const inputWraps = wrapper.findAll('[data-testid^=input-hen-]');

  //   expect(inputWraps).toHaveLength(5);
  // });

  it.each([
    'name',
  ])('should emit an update on %p input', (field) => {
    const wrapper = mount(HarvesterEditNetwork, { propsData: { mode: _EDIT } });
    const input = wrapper.find(`[data-testid="input-hen-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it.each([
    'model',
    'networkName',
    'type',
  ])('should emit an update on %p selection change', async(field) => {
    const wrapper = mount(HarvesterEditNetwork, { propsData: { mode: _EDIT } });
    const select = wrapper.find(`[data-testid="input-hen-${ field }"]`);

    select.find('button').trigger('click');
    await wrapper.trigger('keydown.down');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('update')).toHaveLength(1);
  });
});

describe('component: HarvesterEditNetwork, live network change banner', () => {
  const BANNER = '[data-testid="banner-live-network-change"]';
  const nad = (id, type) => ({ id, parseConfig: { type } });
  const nads = [
    nad('default/vlan-100', 'bridge'),
    nad('default/vlan-200', 'bridge'),
    nad('default/overlay', 'kube-ovn'),
    nad('vm-ns/vlan-300', 'bridge'),
    nad('vm-ns/vlan-400', 'bridge'),
  ];
  const store = {
    getters: {
      'harvester-common/getFeatureEnabled': () => true,
      'harvester/all':                      () => nads,
      'i18n/t':                             jest.fn(),
    }
  };
  const nic = (networkName) => ({
    name: 'nic-1', networkName, model: 'virtio', type: 'bridge'
  });
  const mountNetwork = (networkName, props = {}) => mount(HarvesterEditNetwork, {
    props:  {
      mode: _EDIT, value: nic(networkName), canLiveUpdateNADRef: true, ...props
    },
    global: { mocks: { $store: store } },
  });

  it('should show the banner when a bridge network is changed to another bridge network', async() => {
    const wrapper = mountNetwork('default/vlan-100');

    expect(wrapper.find(BANNER).exists()).toBe(false);

    await wrapper.setProps({ value: nic('default/vlan-200') });

    expect(wrapper.find(BANNER).exists()).toBe(true);
  });

  it('should not show the banner when the VM is not running or cannot be live-migrated', async() => {
    const wrapper = mountNetwork('default/vlan-100', { canLiveUpdateNADRef: false });

    await wrapper.setProps({ value: nic('default/vlan-200') });

    expect(wrapper.find(BANNER).exists()).toBe(false);
  });

  it('should not show the banner when a bridge network is changed to an overlay network', async() => {
    const wrapper = mountNetwork('default/vlan-100');

    await wrapper.setProps({ value: nic('default/overlay') });

    expect(wrapper.find(BANNER).exists()).toBe(false);
  });

  it('should resolve a network name without a namespace in the namespace of the VM', async() => {
    const wrapper = mountNetwork('vlan-300', { namespace: 'vm-ns' });

    await wrapper.setProps({ value: nic('vm-ns/vlan-400') });

    expect(wrapper.find(BANNER).exists()).toBe(true);
  });
});
