import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { volumeSize } from '../volume';
import { vmDisks } from '../vm';

jest.mock('@shell/config/types', () => ({ PVC: 'persistentvolumeclaim' }), { virtual: true });
jest.mock('@pkg/utils/regular', () => ({ isValidMac: () => true, isValidDNSLabelName: () => true }), { virtual: true });
jest.mock('@pkg/config/harvester-map', () => ({
  SOURCE_TYPE: {
    NEW: 'New', IMAGE: 'Virtual Machine Image', ATTACH_VOLUME: 'Existing Volume', CONTAINER: 'Container'
  }
}), { virtual: true });
jest.mock('@pkg/utils/vm', () => ({ parseVolumeClaimTemplates: (value) => JSON.parse(value.metadata.annotations['harvesterhci.io/volumeClaimTemplates'] || '[]') }), { virtual: true });

const translations = YAML.parse(fs.readFileSync(path.join(__dirname, '../../l10n/en-us.yaml'), 'utf8'));
const t = (key, args = {}) => {
  const template = key.split('.').reduce((value, part) => value?.[part], translations);

  return typeof template === 'string' ? template.replace(/\{(\w+)\}/g, (_, name) => args[name]) : key;
};
const getters = { 'i18n/t': t, 'harvester/all': () => [] };

function validateDisk(size, image = false) {
  const name = 'disk-1';
  const claim = {
    metadata: { name, annotations: image ? { 'harvesterhci.io/imageId': 'default/image' } : undefined },
    spec:     { resources: { requests: { storage: size } }, storageClassName: 'longhorn' }
  };
  const value = { metadata: { namespace: 'default', annotations: { 'harvesterhci.io/volumeClaimTemplates': JSON.stringify([claim]) } } };
  const spec = { template: { spec: { volumes: [{ name, persistentVolumeClaim: { claimName: name } }], domain: { devices: { disks: [{ name, disk: {} }] } } } } };

  return vmDisks(spec, getters, [], [], '', value);
}

describe('volume size validation', () => {
  it.each([
    ['-5Gi', 'Invalid value: "-5Gi": must be greater than zero'],
    ['0Gi', 'Invalid value: "0Gi": must be greater than zero'],
    ['1Gi', null],
    ['999999999Gi', null],
    ['1000000000Gi', 'Exceed maximum size 999999999 Gi!'],
    ['invalid', 'Exceed maximum size 999999999 Gi!'],
    [null, 'validation.required']
  ])('validates %p consistently for volumes and VM disks', (size, expected) => {
    const volumeErrors = volumeSize(size, getters, []);
    const diskErrors = validateDisk(size);

    expect(volumeErrors).toStrictEqual(expected ? [expected] : []);
    expect(diskErrors).toStrictEqual(expected ? [`disk-1: ${ expected }`] : []);
  });

  it('validates image-backed VM disks too', () => {
    expect(validateDisk('-5Gi', true)).toStrictEqual(['disk-1: Invalid value: "-5Gi": must be greater than zero']);
  });

  it('allows a no-media CD-ROM without a volume claim', () => {
    const spec = { template: { spec: { volumes: [], domain: { devices: { disks: [{ name: 'no-media', cdrom: { bus: 'sata' } }] } } } } };
    const value = { metadata: { namespace: 'default', annotations: { 'harvesterhci.io/volumeClaimTemplates': '[]' } } };

    expect(vmDisks(spec, getters, [], [], '', value)).toStrictEqual([]);
  });
});
