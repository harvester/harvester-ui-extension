import { setHostDevices } from '../vm';

describe('setHostDevices', () => {
  const pci = { name: 'node1-000001000', deviceName: 'nvidia.com/GA102' };
  const usb = { name: 'node1-001002', deviceName: 'kubevirt.io/node1-001002' };
  const spec = (hostDevices) => ({ domain: { devices: hostDevices ? { disks: [], hostDevices } : { disks: [] } } });

  it('should not add the field when the list is empty and the VM had no host devices', () => {
    const value = spec();

    setHostDevices(value, [], false);

    expect(value.domain.devices).toStrictEqual({ disks: [] });
  });

  it('should remove the field again when a device is added and removed on a VM without host devices', () => {
    const value = spec();

    setHostDevices(value, [pci], false);
    setHostDevices(value, [], false);

    expect('hostDevices' in value.domain.devices).toBe(false);
  });

  it('should write an empty list when all devices are removed from a VM that had host devices', () => {
    const value = spec([pci, usb]);

    setHostDevices(value, [], true);

    expect(value.domain.devices.hostDevices).toStrictEqual([]);
  });

  it('should write the devices when a device is added', () => {
    const value = spec();

    setHostDevices(value, [usb], false);
    expect(value.domain.devices.hostDevices).toStrictEqual([usb]);

    setHostDevices(value, [usb, pci], false);
    expect(value.domain.devices.hostDevices).toStrictEqual([usb, pci]);
  });
});
