import HciClusterNetwork from '../network.harvesterhci.io.clusternetwork';
import HciVlanConfig from '../network.harvesterhci.io.vlanconfig';

// The Steve base model pulls in most of the dashboard, none of that is needed here
jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));

function createClusterNetwork(labels) {
  const cn = new HciClusterNetwork();

  cn.metadata = { name: 'storage', labels };

  return cn;
}

function createVlanConfig(uplink) {
  const vc = new HciVlanConfig();

  vc.spec = { clusterNetwork: 'storage', uplink };
  vc.t = (key) => key;

  return vc;
}

describe('cluster network uplink mode', () => {
  it('is isolated when the network controller labeled it', () => {
    expect(createClusterNetwork({ 'network.harvesterhci.io/uplink-mode': 'isolated' }).isIsolatedUplink).toBe(true);
  });

  it('is not isolated without the label or with another value', () => {
    expect(createClusterNetwork(undefined).isIsolatedUplink).toBe(false);
    expect(createClusterNetwork({ 'network.harvesterhci.io/uplink-mode': 'bond' }).isIsolatedUplink).toBe(false);
  });
});

describe('vlan config uplink mode', () => {
  it('shows isolated vlan configs with their own type', () => {
    const vc = createVlanConfig({ mode: 'isolated', nics: ['eth1', 'eth2'] });

    expect(vc.isIsolatedUplink).toBe(true);
    expect(vc.typeDisplay).toBe('harvester.vlanConfig.uplink.mode.isolatedType');
  });

  it('keeps the VLAN type for bonded uplinks', () => {
    const vc = createVlanConfig({ nics: ['eth1'], bondOptions: { mode: 'active-backup' } });

    expect(vc.isIsolatedUplink).toBe(false);
    expect(vc.typeDisplay).toBe('VLAN');
  });
});
