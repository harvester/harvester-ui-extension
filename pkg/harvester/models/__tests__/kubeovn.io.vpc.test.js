import HciVPC from '../kubeovn.io.vpc';

jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));

function createVpc(spec, { subnets = [], gateways = [], hasGatewayType = true } = {}) {
  const $getters = {
    all:       (type) => (type === 'kubeovn.io.subnet' ? subnets : gateways),
    schemaFor: () => hasGatewayType,
  };

  return Object.assign(Object.create(HciVPC.prototype), {
    metadata: { name: 'commonvpc' }, spec, $getters
  });
}

describe('class HciVPC', () => {
  it.each([
    ['no BFD port', {}, false],
    ['a disabled BFD port', { bfdPort: { enabled: false, ip: '10.255.255.255' } }, false],
    ['an enabled BFD port without an IP', { bfdPort: { enabled: true, ip: ' ' } }, false],
    ['an enabled BFD port with an IP', { bfdPort: { enabled: true, ip: '10.255.255.255' } }, true],
  ])('should report a VPC with %s', (_, spec, enabled) => {
    expect(createVpc(spec).bfdPortEnabled).toBe(enabled);
  });

  it('should list the subnets of the VPC', () => {
    const subnets = [{ id: 'subnetinternal', spec: { vpc: 'commonvpc' } }, { id: 'ovn-default', spec: { vpc: 'ovn-cluster' } }];

    expect(createVpc({}, { subnets }).subnetResources.map((subnet) => subnet.id)).toStrictEqual(['subnetinternal']);
  });

  it('should list the gateways of the VPC that have BFD on', () => {
    const gateways = [
      { id: 'default/bfd-on', spec: { vpc: 'commonvpc', bfd: { enabled: true } } },
      { id: 'default/bfd-off', spec: { vpc: 'commonvpc', bfd: { enabled: false } } },
      { id: 'default/other-vpc', spec: { vpc: 'othervpc', bfd: { enabled: true } } },
    ];

    expect(createVpc({}, { gateways }).bfdEgressGateways.map((gateway) => gateway.id)).toStrictEqual(['default/bfd-on']);
  });

  it('should count a gateway without a VPC as one of the default VPC', () => {
    const gateways = [{ id: 'default/no-vpc', spec: { bfd: { enabled: true } } }];
    const vpc = createVpc({}, { gateways });

    vpc.metadata.name = 'ovn-cluster';

    expect(vpc.bfdEgressGateways.map((gateway) => gateway.id)).toStrictEqual(['default/no-vpc']);
  });

  it('should list no gateways when the cluster has no Egress Gateway type', () => {
    const gateways = [{ id: 'default/bfd-on', spec: { vpc: 'commonvpc', bfd: { enabled: true } } }];

    expect(createVpc({}, { gateways, hasGatewayType: false }).bfdEgressGateways).toStrictEqual([]);
  });
});
