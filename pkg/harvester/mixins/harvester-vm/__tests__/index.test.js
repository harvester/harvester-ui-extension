import { PVC } from '@shell/config/types';
import VmMixin, { LUN, HARD_DISK, CD_ROM } from '../index';

// The mixin's `this` for the disk methods, with one attached RWX Block volume in the store
function vmForm() {
  const pvc = {
    id:       'default/san-lun',
    metadata: { name: 'san-lun' },
    spec:     {
      accessModes: ['ReadWriteMany'], volumeMode: 'Block', storageClassName: 'netapp-iscsi', resources: { requests: { storage: '20Gi' } }
    },
  };
  const ctx = {
    value:            { metadata: { namespace: 'default' } },
    pvcs:             [],
    images:           [],
    customVolumeMode: 'Block',
    $store:           { getters: { 'harvester/all': (type) => (type === PVC ? [pvc] : []) } },
  };

  ['getDiskRows', 'parseDisk', 'mergeDeviceList'].forEach((name) => {
    ctx[name] = VmMixin.methods[name].bind(ctx);
  });

  return ctx;
}

// A VM with one disk on the attached volume
function vm(disk) {
  return {
    metadata: {
      name: 'fci-1', namespace: 'default', annotations: {}
    },
    spec:     {
      template: {
        spec: {
          domain:  { devices: { disks: [{ name: 'fci-quorum', ...disk }] } },
          volumes: [{ name: 'fci-quorum', persistentVolumeClaim: { claimName: 'san-lun' } }],
        }
      }
    }
  };
}

describe('mixin: harvester-vm lun disks', () => {
  it('should read a lun disk with its bus, reservation and error policy', () => {
    const [row] = vmForm().getDiskRows(vm({
      shareable: true, errorPolicy: 'report', lun: { bus: 'scsi', reservation: true }
    }));

    expect(row).toMatchObject({
      type: LUN, bus: 'scsi', shareable: true, reservation: true, errorPolicy: 'report', volumeName: 'san-lun'
    });
  });

  it('should read a lun disk without reservation or error policy', () => {
    const [row] = vmForm().getDiskRows(vm({ lun: { bus: 'scsi' } }));

    expect(row).toMatchObject({
      type: LUN, reservation: false, errorPolicy: ''
    });
  });

  it('should build a lun disk with reservation on the SCSI bus', () => {
    const disk = vmForm().parseDisk({
      name: 'fci-quorum', type: LUN, bus: 'virtio', reservation: true, errorPolicy: 'stop', shareable: true
    }, 0);

    expect(disk).toStrictEqual({
      name: 'fci-quorum', lun: { bus: 'scsi', reservation: true }, errorPolicy: 'stop', shareable: true, bootOrder: 1
    });
  });

  it('should build a lun disk with the report error policy by default and no reservation unless asked', () => {
    const disk = vmForm().parseDisk({
      name: 'fci-quorum', type: LUN, reservation: false, errorPolicy: '', shareable: true
    }, 1);

    expect(disk).toStrictEqual({
      name: 'fci-quorum', lun: { bus: 'scsi' }, errorPolicy: 'report', shareable: true, bootOrder: 2
    });
  });

  it('should not set an error policy on other disk types', () => {
    const form = vmForm();

    expect(form.parseDisk({
      name: 'disk-0', type: HARD_DISK, bus: 'virtio', errorPolicy: 'report'
    }, 0).errorPolicy).toBeUndefined();
    expect(form.parseDisk({
      name: 'cd', type: CD_ROM, bus: 'sata', errorPolicy: 'report'
    }, 0).errorPolicy).toBeUndefined();
  });

  it.each([
    ['lun', { lun: { bus: 'scsi', reservation: true } }, { disk: { bus: 'virtio' }, cdrom: { bus: 'sata' } }],
    ['disk', { disk: { bus: 'virtio' } }, { lun: { bus: 'scsi' }, cdrom: { bus: 'sata' } }],
    ['cdrom', { cdrom: { bus: 'sata' } }, { lun: { bus: 'scsi' }, disk: { bus: 'virtio' } }],
  ])('should keep only the %s target when merging a disk into the spec', (type, device, other) => {
    const [merged] = vmForm().mergeDeviceList([{
      name: 'd', ...other, cache: 'none'
    }], [{ name: 'd', ...device }]);

    expect(merged).toStrictEqual({
      name: 'd', ...device, cache: 'none'
    });
  });
});
