import { vmDisks } from '@pkg/harvester/validators/vm';

describe('validator: vmDisks', () => {
  const getters = {
    'i18n/t':         (key, args) => `${ key } ${ JSON.stringify(args || {}) }`,
    'harvester/all':  () => [],
    'harvester/byId': () => undefined,
  };

  const specWith = (disk) => ({
    template: {
      spec: {
        domain:  { devices: { disks: [disk] } },
        volumes: [{ name: disk.name, persistentVolumeClaim: { claimName: disk.name } }],
      }
    }
  });

  const typeErrors = (disk) => {
    const spec = specWith(disk);
    const errors = [];

    vmDisks.call({}, spec, getters, errors, [], '', { metadata: { annotations: {} }, spec });

    return errors.filter((e) => e.includes('harvester.fields.type'));
  };

  it.each([
    ['disk', { name: 'data', disk: { bus: 'virtio' } }],
    ['cdrom', { name: 'iso', cdrom: { bus: 'sata' } }],
    ['lun', {
      name: 'quorum', lun: { bus: 'scsi', reservation: true }, shareable: true
    }],
  ])('should accept a %s device', (_, disk) => {
    expect(typeErrors(disk)).toHaveLength(0);
  });

  it('should require a device type', () => {
    expect(typeErrors({ name: 'broken' })).toHaveLength(1);
  });
});
