import { shallowMount } from '@vue/test-utils';
import VirtualMachineUSBDevices from '../index.vue';

describe('component: VirtualMachineUSBDevices', () => {
  const usbDevice = {
    name:     'node1-001002',
    metadata: { name: 'node1-001002' },
    status:   { resourceName: 'kubevirt.io/node1-001002', enabled: true },
  };
  const mountUSB = (devices) => shallowMount(VirtualMachineUSBDevices, {
    props:  { value: { domain: { devices } }, vm: {} },
    global: {
      mocks: {
        $store: {
          getters:  { 'harvester/schemaFor': () => ({}), 'i18n/t': jest.fn() },
          dispatch: jest.fn(() => Promise.resolve([])),
        },
        $fetchState: { pending: false },
      },
    },
  });

  it('should not add hostDevices once the devices have loaded with nothing selected', async() => {
    const wrapper = mountUSB({ disks: [] });

    wrapper.vm.selectedDevices = [];
    await wrapper.vm.$nextTick();

    expect(wrapper.props('value').domain.devices).toStrictEqual({ disks: [] });
  });

  it('should save the removal of all devices of a VM that had host devices', async() => {
    const wrapper = mountUSB({ hostDevices: [{ name: 'node1-001002', deviceName: 'kubevirt.io/node1-001002' }] });

    wrapper.vm.devices = [usbDevice];
    wrapper.vm.selectedDevices = ['node1-001002'];
    await wrapper.vm.$nextTick();
    wrapper.vm.selectedDevices = [];
    await wrapper.vm.$nextTick();

    expect(wrapper.props('value').domain.devices.hostDevices).toStrictEqual([]);
  });
});
