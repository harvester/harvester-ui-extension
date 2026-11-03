import { shallowMount } from '@vue/test-utils';
import VirtualMachinePciDevices from '../index.vue';

describe('component: VirtualMachinePciDevices', () => {
  const pciDevice = {
    name:        'node1-000001000',
    metadata:    { name: 'node1-000001000' },
    status:      { resourceName: 'nvidia.com/GA102', nodeName: 'node1' },
    isEnabled:   true,
    claimedByMe: true,
  };
  const otherDevice = { name: 'node1-001002', deviceName: 'kubevirt.io/node1-001002' };

  const mountPCI = (devices, pciDevices = []) => shallowMount(VirtualMachinePciDevices, {
    props:  { value: { domain: { devices } }, vm: { isOff: true, metadata: { name: 'vm1' } } },
    global: {
      mocks: {
        $store: {
          getters: {
            'harvester/schemaFor': () => ({}),
            'i18n/t':              jest.fn(),
            clusterId:             'local',
          },
          dispatch: jest.fn((action, { type }) => Promise.resolve(type === 'devices.harvesterhci.io.pcidevice' ? pciDevices : [])),
        },
        $fetchState: { pending: false },
      },
    },
  });

  it('should not add hostDevices once the devices have loaded with nothing selected', async() => {
    const wrapper = mountPCI({ disks: [] }, [pciDevice]);

    await wrapper.vm.$options.fetch.call(wrapper.vm);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.selectedDevices).toStrictEqual([]);
    expect(wrapper.props('value').domain.devices).toStrictEqual({ disks: [] });
  });

  it('should write the selected device into hostDevices', async() => {
    const wrapper = mountPCI({ disks: [] }, [pciDevice]);

    await wrapper.vm.$options.fetch.call(wrapper.vm);
    wrapper.vm.selectedDevices = ['node1-000001000'];
    await wrapper.vm.$nextTick();

    expect(wrapper.props('value').domain.devices.hostDevices).toStrictEqual([
      { deviceName: 'nvidia.com/GA102', name: 'node1-000001000' },
    ]);
  });

  it('should save the removal of all PCI devices of a VM that had host devices', async() => {
    const wrapper = mountPCI({ hostDevices: [{ name: 'node1-000001000', deviceName: 'nvidia.com/GA102' }] }, [pciDevice]);

    await wrapper.vm.$options.fetch.call(wrapper.vm);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedDevices).toStrictEqual(['node1-000001000']);

    wrapper.vm.selectedDevices = [];
    await wrapper.vm.$nextTick();

    expect(wrapper.props('value').domain.devices.hostDevices).toStrictEqual([]);
  });

  it('should keep the host devices of the USB tab when no PCI device is selected', async() => {
    const wrapper = mountPCI({ hostDevices: [otherDevice] });

    await wrapper.vm.$options.fetch.call(wrapper.vm);
    wrapper.vm.selectedDevices = [];
    await wrapper.vm.$nextTick();

    expect(wrapper.props('value').domain.devices.hostDevices).toStrictEqual([otherDevice]);
  });
});
