import { NETWORK_ATTACHMENT } from '@shell/config/types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import HarvesterEditVM from '../index.vue';

const NADS = [
  { id: 'default/vlan-100', parseConfig: { type: 'bridge' } },
  { id: 'default/vlan-200', parseConfig: { type: 'bridge' } },
  { id: 'default/overlay', parseConfig: { type: 'kube-ovn' } },
  { id: 'default/overlay-2', parseConfig: { type: 'kube-ovn' } },
  { id: 'harvester-system/mgmt', parseConfig: { type: 'kube-ovn' } },
];

// A VM with one NIC per network name, `null` being the pod network
function vm({ networks = ['vlan-100'], cores = 1, disks = [{ metadata: { name: 'disk-0' }, spec: { resources: { requests: { storage: '10Gi' } } } }] } = {}) {
  return {
    metadata: {
      namespace:   'default',
      annotations: { [HCI_ANNOTATIONS.VOLUME_CLAIM_TEMPLATE]: JSON.stringify(disks) },
    },
    spec: {
      template: {
        spec: {
          domain:   { cpu: { cores } },
          networks: networks.map((networkName, i) => (networkName ? { name: `nic-${ i }`, multus: { networkName } } : { name: `nic-${ i }`, pod: {} })),
        }
      }
    }
  };
}

// The edit page's `this` for the restart check, `canLiveUpdateNADRef` comes from the VM model
function editPage({ canLiveUpdateNADRef = true } = {}) {
  const all = jest.fn((type) => (type === NETWORK_ATTACHMENT ? NADS : []));
  const ctx = {
    value:  { canLiveUpdateNADRef, metadata: { namespace: 'default' } },
    $store: { getters: { 'harvester/all': all } },
  };

  ['_shouldPromptRestart', '_isLiveNetworkChange', '_compareDisksIgnoreStorage'].forEach((name) => {
    ctx[name] = HarvesterEditVM.methods[name].bind(ctx);
  });

  return ctx;
}

describe('edit: kubevirt.io.virtualmachine restart prompt', () => {
  it('should not prompt for a restart when only the bridge network of a NIC changes on a live-migratable VM', () => {
    expect(editPage()._shouldPromptRestart(vm(), vm({ networks: ['vlan-200'] }))).toBe(false);
  });

  it('should not prompt for a restart when only the overlay network of a NIC changes on a live-migratable VM', () => {
    expect(editPage()._shouldPromptRestart(vm({ networks: ['overlay'] }), vm({ networks: ['overlay-2'] }))).toBe(false);
  });

  it('should prompt for a restart for the same change when the VM cannot live-update the NAD', () => {
    expect(editPage({ canLiveUpdateNADRef: false })._shouldPromptRestart(vm(), vm({ networks: ['vlan-200'] }))).toBe(true);
  });

  it('should prompt for a restart when another setting changes as well', () => {
    expect(editPage()._shouldPromptRestart(vm(), vm({ networks: ['vlan-200'], cores: 2 }))).toBe(true);
  });

  it('should prompt for a restart when a disk changes as well', () => {
    const newVM = vm({ networks: ['vlan-200'], disks: [{ metadata: { name: 'disk-1' }, spec: {} }] });

    expect(editPage()._shouldPromptRestart(vm(), newVM)).toBe(true);
  });

  it('should not prompt for a restart when only the size of a disk changes', () => {
    const newVM = vm({ disks: [{ metadata: { name: 'disk-0' }, spec: { resources: { requests: { storage: '20Gi' } } } }] });

    expect(editPage()._shouldPromptRestart(vm(), newVM)).toBe(false);
  });

  it.each([
    ['to an overlay network', ['vlan-100'], ['overlay']],
    ['from an overlay network to a bridge network', ['overlay'], ['vlan-100']],
    ['from the management network', ['harvester-system/mgmt'], ['overlay']],
    ['from the pod network', [null], ['vlan-200']],
    ['when a NIC is added', ['vlan-100'], ['vlan-100', 'vlan-200']],
  ])('should prompt for a restart when the network changes %s', (_, oldNetworks, newNetworks) => {
    expect(editPage()._shouldPromptRestart(vm({ networks: oldNetworks }), vm({ networks: newNetworks }))).toBe(true);
  });

  it('should not look at the networks when nothing changed', () => {
    const page = editPage();

    expect(page._shouldPromptRestart(vm(), vm())).toBe(false);
    expect(page.$store.getters['harvester/all']).not.toHaveBeenCalled();
  });
});
