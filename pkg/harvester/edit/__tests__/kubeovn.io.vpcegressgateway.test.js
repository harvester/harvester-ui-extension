import EditVpcEgressGateway from '../kubeovn.io.vpcegressgateway.vue';

const { validate, toSpec } = EditVpcEgressGateway.methods;
const { vpc: onVpcChange } = EditVpcEgressGateway.watch;

const t = (key, args) => (args ? `${ key } ${ JSON.stringify(args) }` : key);

function createContext(form = {}, spec = {}) {
  const value = { metadata: { name: 'gateway1', namespace: 'default' }, spec };

  return {
    t,
    value,
    ...EditVpcEgressGateway.data.call({ value }),
    vpc:            'commonvpc',
    replicas:       2,
    internalSubnet: 'subnetinternal',
    externalSubnet: 'subnetexternal',
    policies:       [{ snat: true, subnets: ['subnetinternal'] }],
    ...form,
  };
}

describe('edit: kubeovn.io.vpcegressgateway', () => {
  it('should start a new gateway with one replica, one SNAT policy and BFD off', () => {
    const data = EditVpcEgressGateway.data.call({ value: { metadata: {} } });

    expect(data.replicas).toBe(1);
    expect(data.policies).toStrictEqual([{ snat: true, subnets: [] }]);
    expect(data.bfd).toStrictEqual({
      enabled: false, minRX: 1000, minTX: 1000, multiplier: 3
    });
  });

  it('should build the spec from the form and leave out empty optional fields', () => {
    const spec = toSpec.call(createContext());

    expect(spec).toStrictEqual({
      vpc:            'commonvpc',
      replicas:       2,
      internalSubnet: 'subnetinternal',
      externalSubnet: 'subnetexternal',
      policies:       [{ snat: true, subnets: ['subnetinternal'] }],
      bfd:            {
        enabled: false, minRX: 1000, minTX: 1000, multiplier: 3
      },
    });
  });

  it('should build the spec with IPs, BFD and bandwidth', () => {
    const spec = toSpec.call(createContext({
      internalIPs:      ['172.20.10.41', ' 172.20.10.51 ', ''],
      externalIPs:      ['10.115.48.220', '10.115.48.221'],
      bfd:              {
        enabled: true, minRX: '50', minTX: 50, multiplier: 3
      },
      bandwidthIngress: 10,
      bandwidthEgress:  null,
    }));

    expect(spec.internalIPs).toStrictEqual(['172.20.10.41', '172.20.10.51']);
    expect(spec.externalIPs).toStrictEqual(['10.115.48.220', '10.115.48.221']);
    expect(spec.bfd).toStrictEqual({
      enabled: true, minRX: 50, minTX: 50, multiplier: 3
    });
    expect(spec.bandwidth).toStrictEqual({ ingress: 10 });
  });

  it('should keep the fields the form does not show', () => {
    const existing = {
      trafficPolicy: 'Local',
      selectors:     [{ namespaceSelector: { matchLabels: { app: 'web' } } }],
      policies:      [{ snat: false, ipBlocks: ['10.0.0.0/24'] }],
    };
    const context = createContext({}, existing);

    context.policies = EditVpcEgressGateway.data.call({ value: context.value }).policies;

    const spec = toSpec.call(context);

    expect(spec.trafficPolicy).toBe('Local');
    expect(spec.selectors).toStrictEqual(existing.selectors);
    expect(spec.policies).toStrictEqual([{
      snat: false, ipBlocks: ['10.0.0.0/24'], subnets: []
    }]);
    expect(validate.call(context)).toStrictEqual([]);
  });

  it('should accept a complete form', () => {
    expect(validate.call(createContext())).toStrictEqual([]);
  });

  it.each([
    ['no VPC', { vpc: '' }, 'validation.required'],
    ['no internal subnet', { internalSubnet: '' }, 'validation.required'],
    ['no external subnet', { externalSubnet: '' }, 'validation.required'],
    ['too many replicas', { replicas: 11 }, 'harvester.egressGateway.validation.replicas'],
    ['no policy', { policies: [] }, 'harvester.egressGateway.validation.policyRequired'],
    ['a policy without subnets', { policies: [{ snat: true, subnets: [] }] }, 'harvester.egressGateway.validation.policySubnets'],
    ['an invalid IP', { externalIPs: ['10.115.48.300', '10.115.48.221'] }, 'harvester.egressGateway.validation.ipList'],
    ['fewer IPs than replicas', { internalIPs: ['172.20.10.41'] }, 'harvester.egressGateway.validation.ipCount'],
    ['a BFD interval of 0', {
      bfd: {
        enabled: true, minRX: 0, minTX: 50, multiplier: 3
      }
    }, 'harvester.egressGateway.validation.bfd'],
    ['a negative bandwidth', { bandwidthEgress: -1 }, 'harvester.egressGateway.validation.bandwidth'],
  ])('should reject %s', (_, form, errorKey) => {
    const errors = validate.call(createContext(form));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(errorKey);
  });

  it('should drop the subnets of the previous VPC when the VPC changes', () => {
    const context = createContext({
      vpc:              'othervpc',
      internalSubnet:   'subnetinternal',
      policies:         [{ snat: true, subnets: ['subnetinternal', 'othersubnet'] }],
      vpcSubnetOptions: [{ label: 'othersubnet', value: 'othersubnet' }],
    });

    onVpcChange.call(context, 'othervpc', 'commonvpc');

    expect(context.internalSubnet).toBe('');
    expect(context.policies).toStrictEqual([{ snat: true, subnets: ['othersubnet'] }]);
  });
});
