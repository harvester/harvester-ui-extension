import { reactive } from 'vue';
import { getLatestMigration, isBridgeNAD, isNADOnlyChange } from '../vm';

const migration = (namespace, timestamp, vmiName = 'vm1') => ({
  metadata: { namespace, creationTimestamp: timestamp },
  spec:     { vmiName },
});

describe('getLatestMigration', () => {
  it('should return the newest migration of the VMI in its namespace, regardless of list order', () => {
    const newest = migration('ns1', '2026-01-03T00:00:00Z');
    const list = [
      migration('ns1', '2026-01-01T00:00:00Z'),
      newest,
      migration('ns2', '2026-01-09T00:00:00Z'),
      migration('ns1', '2026-02-01T00:00:00Z', 'vm2'),
    ];

    expect(getLatestMigration(list, 'ns1', 'vm1')).toBe(newest);
  });

  it('should return the first one of several migrations with the same timestamp, as the lookup before the index did', () => {
    const first = { ...migration('ns1', '2026-01-03T00:00:00Z'), id: 'first' };
    const second = { ...migration('ns1', '2026-01-03T00:00:00Z'), id: 'second' };

    expect(getLatestMigration([first, second], 'ns1', 'vm1')).toBe(first);
  });

  it('should return undefined if there is no migration or no VMI name', () => {
    const list = [migration('ns1', '2026-01-01T00:00:00Z')];

    expect(getLatestMigration(list, 'ns2', 'vm1')).toBeUndefined();
    expect(getLatestMigration(list, 'ns1', undefined)).toBeUndefined();
    expect(getLatestMigration([], 'ns1', 'vm1')).toBeUndefined();
  });

  it('should follow changes of a reactive store list', () => {
    const list = reactive([]);
    const first = migration('ns1', '2026-01-01T00:00:00Z');

    expect(getLatestMigration(list, 'ns1', 'vm1')).toBeUndefined();

    list.push(first);
    expect(getLatestMigration(list, 'ns1', 'vm1')).toStrictEqual(first);

    list.push(migration('ns1', '2026-01-02T00:00:00Z'));
    expect(getLatestMigration(list, 'ns1', 'vm1').metadata.creationTimestamp).toBe('2026-01-02T00:00:00Z');

    list.splice(0, 2);
    expect(getLatestMigration(list, 'ns1', 'vm1')).toBeUndefined();
  });
});

describe('isBridgeNAD', () => {
  const nads = [
    { id: 'default/vlan-100', parseConfig: { type: 'bridge' } },
    { id: 'vm-ns/vlan-200', parseConfig: { type: 'bridge' } },
    { id: 'vm-ns/overlay', parseConfig: { type: 'kube-ovn' } },
  ];

  it('should look up a namespaced network name as is', () => {
    expect(isBridgeNAD(nads, 'vm-ns/vlan-200', 'other')).toBe(true);
    expect(isBridgeNAD(nads, 'vm-ns/overlay', 'vm-ns')).toBe(false);
  });

  it('should resolve a network name without a namespace in the namespace of the VM', () => {
    expect(isBridgeNAD(nads, 'vlan-200', 'vm-ns')).toBe(true);
    expect(isBridgeNAD(nads, 'vlan-100', 'vm-ns')).toBe(false);
  });

  it('should fall back to the default namespace only when the VM namespace is unknown', () => {
    expect(isBridgeNAD(nads, 'vlan-100')).toBe(true);
  });

  it('should return false for an empty or unknown network name', () => {
    expect(isBridgeNAD(nads, '', 'vm-ns')).toBe(false);
    expect(isBridgeNAD(nads, 'vm-ns/missing', 'vm-ns')).toBe(false);
  });
});

describe('isNADOnlyChange', () => {
  const vm = (networkName, extra = {}) => ({
    spec: {
      template: {
        spec: {
          networks: [{ name: 'default', pod: {} }, { name: 'nic-1', multus: { networkName } }],
          ...extra,
        }
      }
    }
  });
  const isBridge = (name) => name.startsWith('vlan');

  it('should be true when only the NAD of a bridge network changes to another bridge network', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('vlan-200'), isBridge)).toBe(true);
  });

  it('should be false when there is no change', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('vlan-100'), isBridge)).toBe(false);
  });

  it('should be false when the new NAD is not a bridge network', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('overlay'), isBridge)).toBe(false);
  });

  it('should be false when something else changes as well', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('vlan-200', { hostname: 'x' }), isBridge)).toBe(false);
  });

  it('should not modify the VMs', () => {
    const oldVM = vm('vlan-100');
    const newVM = vm('vlan-200');

    isNADOnlyChange(oldVM, newVM, isBridge);

    expect(oldVM.spec.template.spec.networks[1].multus.networkName).toBe('vlan-100');
    expect(newVM.spec.template.spec.networks[1].multus.networkName).toBe('vlan-200');
  });
});
