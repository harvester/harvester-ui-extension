import { reactive } from 'vue';
import { getLatestMigration, liveSwapNADType, canLiveSwapNAD, isNADOnlyChange } from '../vm';

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

const nads = [
  { id: 'default/vlan-100', parseConfig: { type: 'bridge' } },
  { id: 'vm-ns/vlan-200', parseConfig: { type: 'bridge' } },
  { id: 'vm-ns/overlay', parseConfig: { type: 'kube-ovn' } },
  { id: 'vm-ns/overlay-2', parseConfig: { type: 'kube-ovn' } },
  { id: 'vm-ns/sriov', parseConfig: { type: 'sriov' } },
  { id: 'harvester-system/mgmt', parseConfig: { type: 'kube-ovn' } },
];

describe('liveSwapNADType', () => {
  it('should look up a namespaced network name as is', () => {
    expect(liveSwapNADType(nads, 'vm-ns/vlan-200', 'other')).toBe('bridge');
    expect(liveSwapNADType(nads, 'vm-ns/overlay', 'other')).toBe('kube-ovn');
  });

  it('should resolve a network name without a namespace in the namespace of the VM', () => {
    expect(liveSwapNADType(nads, 'vlan-200', 'vm-ns')).toBe('bridge');
    expect(liveSwapNADType(nads, 'vlan-100', 'vm-ns')).toBeUndefined();
  });

  it('should fall back to the default namespace only when the VM namespace is unknown', () => {
    expect(liveSwapNADType(nads, 'vlan-100')).toBe('bridge');
  });

  it('should return undefined for other CNI types and for the management network', () => {
    expect(liveSwapNADType(nads, 'vm-ns/sriov', 'vm-ns')).toBeUndefined();
    expect(liveSwapNADType(nads, 'harvester-system/mgmt', 'vm-ns')).toBeUndefined();
  });

  it('should return undefined for an empty or unknown network name', () => {
    expect(liveSwapNADType(nads, '', 'vm-ns')).toBeUndefined();
    expect(liveSwapNADType(nads, 'vm-ns/missing', 'vm-ns')).toBeUndefined();
  });
});

describe('canLiveSwapNAD', () => {
  it('should be true from a bridge network to another bridge network', () => {
    expect(canLiveSwapNAD(nads, 'default/vlan-100', 'vm-ns/vlan-200', 'vm-ns')).toBe(true);
  });

  it('should be true from an overlay network to another overlay network', () => {
    expect(canLiveSwapNAD(nads, 'overlay', 'overlay-2', 'vm-ns')).toBe(true);
  });

  it('should be false between a bridge network and an overlay network', () => {
    expect(canLiveSwapNAD(nads, 'vlan-200', 'overlay', 'vm-ns')).toBe(false);
    expect(canLiveSwapNAD(nads, 'overlay', 'vlan-200', 'vm-ns')).toBe(false);
  });

  it('should be false to or from the management network', () => {
    expect(canLiveSwapNAD(nads, 'harvester-system/mgmt', 'overlay', 'vm-ns')).toBe(false);
    expect(canLiveSwapNAD(nads, 'overlay', 'harvester-system/mgmt', 'vm-ns')).toBe(false);
  });

  it('should be false for other CNI types and unknown networks', () => {
    expect(canLiveSwapNAD(nads, 'sriov', 'sriov', 'vm-ns')).toBe(false);
    expect(canLiveSwapNAD(nads, 'missing', 'other-missing', 'vm-ns')).toBe(false);
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
  // vlan-* stand for bridge NADs and overlay-* for kube-ovn NADs
  const type = (name) => name.split('-')[0];
  const canSwap = (oldName, newName) => type(oldName) === type(newName);

  it('should be true when only the NAD of a bridge network changes to another bridge network', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('vlan-200'), canSwap)).toBe(true);
  });

  it('should be true when only the NAD of an overlay network changes to another overlay network', () => {
    expect(isNADOnlyChange(vm('overlay-1'), vm('overlay-2'), canSwap)).toBe(true);
  });

  it('should ignore the bridge binding the form adds next to the managedtap binding of an overlay NIC', () => {
    const iface = {
      binding: { name: 'managedtap' }, macAddress: '86:19:7e:5c:95:ba', model: 'virtio', name: 'nic-1'
    };
    const oldVM = vm('overlay-1', { domain: { devices: { interfaces: [iface] } } });
    const newVM = vm('overlay-2', { domain: { devices: { interfaces: [{ ...iface, bridge: {} }] } } });

    expect(isNADOnlyChange(oldVM, newVM, canSwap)).toBe(true);
  });

  it('should be false when the binding of an interface changes as well', () => {
    const oldVM = vm('overlay-1', { domain: { devices: { interfaces: [{ name: 'nic-1', binding: { name: 'managedtap' } }] } } });
    const newVM = vm('overlay-2', { domain: { devices: { interfaces: [{ name: 'nic-1', bridge: {} }] } } });

    expect(isNADOnlyChange(oldVM, newVM, canSwap)).toBe(false);
  });

  it('should be false when there is no change', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('vlan-100'), canSwap)).toBe(false);
  });

  it('should be false when the NAD cannot be swapped live, for example bridge to overlay', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('overlay-1'), canSwap)).toBe(false);
  });

  it('should be false when something else changes as well', () => {
    expect(isNADOnlyChange(vm('vlan-100'), vm('vlan-200', { hostname: 'x' }), canSwap)).toBe(false);
  });

  it('should ignore the empty node affinity terms added by the Node Scheduling form', () => {
    const required = {
      nodeSelectorTerms: [{
        matchExpressions: [{
          key: 'network.harvesterhci.io/mgmt', operator: 'In', values: ['true']
        }]
      }]
    };
    const oldVM = vm('vlan-100', { affinity: { nodeAffinity: { requiredDuringSchedulingIgnoredDuringExecution: required } } });
    const newVM = vm('vlan-200', { affinity: { nodeAffinity: { requiredDuringSchedulingIgnoredDuringExecution: required, preferredDuringSchedulingIgnoredDuringExecution: [] } } });

    expect(isNADOnlyChange(oldVM, newVM, canSwap)).toBe(true);

    const preferred = [{
      weight:     1,
      preference: {
        matchExpressions: [{
          key: 'zone', operator: 'In', values: ['a']
        }]
      }
    }];
    const oldPreferredOnly = vm('vlan-100', { affinity: { nodeAffinity: { preferredDuringSchedulingIgnoredDuringExecution: preferred } } });
    const newPreferredOnly = vm('vlan-200', { affinity: { nodeAffinity: { preferredDuringSchedulingIgnoredDuringExecution: preferred, requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: [] } } } });

    expect(isNADOnlyChange(oldPreferredOnly, newPreferredOnly, canSwap)).toBe(true);
  });

  it('should be false when a node affinity term is added as well', () => {
    const preferred = [{
      weight:     1,
      preference: {
        matchExpressions: [{
          key: 'zone', operator: 'In', values: ['a']
        }]
      }
    }];
    const newVM = vm('vlan-200', { affinity: { nodeAffinity: { preferredDuringSchedulingIgnoredDuringExecution: preferred } } });

    expect(isNADOnlyChange(vm('vlan-100'), newVM, canSwap)).toBe(false);
  });

  it('should not modify the VMs', () => {
    const oldVM = vm('vlan-100');
    const newVM = vm('vlan-200', { affinity: { nodeAffinity: { preferredDuringSchedulingIgnoredDuringExecution: [] } } });

    isNADOnlyChange(oldVM, newVM, canSwap);

    expect(oldVM.spec.template.spec.networks[1].multus.networkName).toBe('vlan-100');
    expect(newVM.spec.template.spec.networks[1].multus.networkName).toBe('vlan-200');
    expect(newVM.spec.template.spec.affinity.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution).toStrictEqual([]);
  });
});
