import { HCI } from '@pkg/harvester/types';
import StorageNetwork from '../storage-network.vue';
import RwxNetwork from '../rwx-network.vue';
import VmMigrationNetwork from '../vm-migration-network.vue';
import HarvesterEditNAD from '../../../edit/harvesterhci.io.networkattachmentdefinition.vue';
import HarvesterEditHostNetworkConfig from '../../../edit/network.harvesterhci.io.hostnetworkconfig.vue';

const CLUSTER_NETWORKS = [
  {
    id: 'mgmt', isReady: true, isReadyForStorageNetwork: true, isIsolatedUplink: false
  },
  {
    id: 'storage', isReady: true, isReadyForStorageNetwork: true, isIsolatedUplink: true
  },
  {
    id: 'mesh-2', isReady: false, isReadyForStorageNetwork: false, isIsolatedUplink: true
  },
];

// `this` for the clusterNetworkOptions computed of a settings component or form
function ctx(extra = {}) {
  return {
    t:      (key) => key,
    $store: {
      getters: {
        currentProduct:  { inStore: 'harvester' },
        'harvester/all': (type) => (type === HCI.CLUSTER_NETWORK ? CLUSTER_NETWORKS : []),
      },
    },
    ...extra,
  };
}

const HINT = 'harvester.vlanConfig.uplink.mode.isolatedHint';

describe('cluster networks with isolated uplinks (switchless mesh)', () => {
  it.each([
    ['storage-network', StorageNetwork],
    ['rwx-network', RwxNetwork],
    ['vm-migration-network', VmMigrationNetwork],
  ])('should be offered with the switchless mesh hint in the %s setting', (_, component) => {
    const options = component.computed.clusterNetworkOptions.call(ctx({ networkType: 'L2VlanNetwork' }));

    expect(options).toStrictEqual([
      {
        label: 'mgmt', value: 'mgmt', disabled: false
      },
      {
        label: `storage (${ HINT })`, value: 'storage', disabled: false
      },
      {
        label: `mesh-2 (${ HINT }) (generic.notReady)`, value: 'mesh-2', disabled: true
      },
    ]);
  });

  it.each([
    ['VM network', HarvesterEditNAD],
    ['host network config', HarvesterEditHostNetworkConfig],
  ])('should not be offered in the %s form', (_, component) => {
    const options = component.computed.clusterNetworkOptions.call(ctx());

    expect(options.map((o) => o.value)).toStrictEqual(['mgmt']);
  });
});
