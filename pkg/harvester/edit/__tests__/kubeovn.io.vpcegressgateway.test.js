import EditVpcEgressGateway from '../kubeovn.io.vpcegressgateway.vue';

const {
  validate, validateTabs, ipError, ipCountError, policySubnetsError, toSpec, bfdSpec, saveGateway
} = EditVpcEgressGateway.methods;
const { vpc: onVpcChange } = EditVpcEgressGateway.watch;
const {
  vpcBfdPortDisabled, vpcEditLocation, internalSubnetOptions, externalSubnetOptions
} = EditVpcEgressGateway.computed;

const t = (key, args) => (args ? `${ key } ${ JSON.stringify(args) }` : key);

function createContext(form = {}, spec = {}) {
  const value = { metadata: { name: 'gateway1', namespace: 'default' }, spec };

  const context = {
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

  Object.assign(context, {
    bfdSpec, validateTabs, ipError, ipCountError, policySubnetsError
  });

  return context;
}

// A subnet as the store returns it, with the model getters the form reads
function subnet(id, spec, model = {}) {
  return {
    id, spec, isOverlayAttachment: false, networkAttachment: null, canAssignIP: () => true, ...model
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

  it('should keep a bandwidth quantity as a string and a whole number as Mbps', () => {
    const context = createContext({ bandwidthIngress: ' 1Gi ', bandwidthEgress: '100' });

    expect(validate.call(context)).toStrictEqual([]);
    expect(toSpec.call(context).bandwidth).toStrictEqual({ ingress: '1Gi', egress: 100 });
  });

  it('should send the BFD defaults for intervals cleared while BFD is off', () => {
    const context = createContext({
      bfd: {
        enabled: false, minRX: '', minTX: 50, multiplier: null
      }
    });

    expect(validate.call(context)).toStrictEqual([]);
    expect(toSpec.call(context).bfd).toStrictEqual({
      enabled: false, minRX: 1000, minTX: 50, multiplier: 3
    });
  });

  it('should list only the subnets of the VPC that sit on a virtual machine network as internal subnets', () => {
    const vpcSubnets = [
      subnet('ovn-default', { vpc: 'ovn-cluster', provider: 'ovn' }),
      subnet('subnetinternal', { vpc: 'commonvpc', provider: 'vmnet.default.ovn' }, { isOverlayAttachment: true }),
    ];

    expect(internalSubnetOptions.call({ vpcSubnets })).toStrictEqual([{ label: 'subnetinternal', value: 'subnetinternal' }]);
  });

  it('should list only the subnets attached to a network as external subnets', () => {
    const allSubnets = [
      subnet('join', { vpc: 'ovn-cluster', provider: 'ovn' }),
      subnet('subnetexternal', { vpc: 'commonvpc', provider: 'extnet.default' }, { networkAttachment: { name: 'extnet', namespace: 'default' } }),
    ];

    expect(externalSubnetOptions.call({ allSubnets })).toStrictEqual([{ label: 'subnetexternal', value: 'subnetexternal' }]);
  });

  it('should check the IPs against the subnet they belong to', () => {
    const internalSubnetResource = subnet('subnetinternal', { cidrBlock: '172.20.10.0/24' }, { canAssignIP: (ip) => ip.startsWith('172.20.10.') });
    const errors = validate.call(createContext({ internalSubnetResource, internalIPs: ['172.20.10.41', '10.0.0.1'] }));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('harvester.egressGateway.validation.ipSubnet');
    expect(errors[0]).toContain('172.20.10.0/24');
  });

  it('should put each error on the tab that holds the field', () => {
    const errors = validateTabs.call(createContext({
      replicas:         11,
      policies:         [],
      externalIPs:      ['10.115.48.300'],
      bfd:              {
        enabled: true, minRX: 0, minTX: 50, multiplier: 3
      },
      bandwidthIngress: '10Mbps',
    }));

    expect(Object.fromEntries(Object.entries(errors).map(([tab, messages]) => [tab, messages.length]))).toStrictEqual({
      basic: 1, policies: 1, ips: 1, bfd: 1, bandwidth: 1
    });
    expect(errors.policies[0]).toContain('harvester.egressGateway.validation.policyRequired');
  });

  it('should leave an empty IP row to the save, which drops it', () => {
    expect(ipError.call(createContext(), 'internalIPs', ' ')).toBeUndefined();
  });

  it('should accept a policy with only IP blocks', () => {
    expect(policySubnetsError.call(createContext(), { subnets: [], ipBlocks: ['10.0.0.0/24'] })).toBeUndefined();
  });

  it('should stop the save when the form has errors', async() => {
    const buttonCb = jest.fn();
    const context = createContext({
      vpc: '', validate, save: jest.fn()
    });

    await saveGateway.call(context, buttonCb);

    expect(buttonCb).toHaveBeenCalledWith(false);
    expect(context.save).not.toHaveBeenCalled();
    expect(context.errors).toHaveLength(1);
  });

  it('should save the spec built from the form', async() => {
    const buttonCb = jest.fn();
    const context = createContext({
      validate, toSpec, save: jest.fn()
    });

    await saveGateway.call(context, buttonCb);

    expect(context.save).toHaveBeenCalledWith(buttonCb);
    expect(context.value.spec.vpc).toBe('commonvpc');
    expect(context.value.spec.policies).toStrictEqual([{ snat: true, subnets: ['subnetinternal'] }]);
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
    ['the same internal and external subnet', { externalSubnet: 'subnetinternal' }, 'harvester.egressGateway.validation.sameSubnet'],
    ['too many replicas', { replicas: 11 }, 'harvester.egressGateway.validation.replicas'],
    ['no policy', { policies: [] }, 'harvester.egressGateway.validation.policyRequired'],
    ['a policy without subnets', { policies: [{ snat: true, subnets: [] }] }, 'harvester.egressGateway.validation.policySubnets'],
    ['an invalid IP', { externalIPs: ['10.115.48.300', '10.115.48.221'] }, 'harvester.egressGateway.validation.ipList'],
    ['fewer IPs than replicas', { internalIPs: ['172.20.10.41'] }, 'harvester.egressGateway.validation.ipCount'],
    ['a repeated IP', { externalIPs: ['10.115.48.220', ' 10.115.48.220'] }, 'harvester.egressGateway.validation.ipDuplicate'],
    ['a BFD interval of 0', {
      bfd: {
        enabled: true, minRX: 0, minTX: 50, multiplier: 3
      }
    }, 'harvester.egressGateway.validation.bfd'],
    ['a negative bandwidth', { bandwidthEgress: -1 }, 'harvester.egressGateway.validation.bandwidth'],
    ['a bandwidth with an unknown unit', { bandwidthEgress: '10Mbps' }, 'harvester.egressGateway.validation.bandwidth'],
  ])('should reject %s', (_, form, errorKey) => {
    const errors = validate.call(createContext(form));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(errorKey);
  });

  it('should drop the subnets of the previous VPC when the VPC changes', () => {
    const context = createContext({
      vpc:                   'othervpc',
      internalSubnet:        'subnetinternal',
      policies:              [{ snat: true, subnets: ['subnetinternal', 'othersubnet'] }],
      vpcSubnetOptions:      [{ label: 'othersubnet', value: 'othersubnet' }],
      internalSubnetOptions: [{ label: 'othersubnet', value: 'othersubnet' }],
    });

    onVpcChange.call(context, 'othervpc', 'commonvpc');

    expect(context.internalSubnet).toBe('');
    expect(context.policies).toStrictEqual([{ snat: true, subnets: ['othersubnet'] }]);
  });

  it.each([
    ['has no BFD port', { bfdPortEnabled: false }, true],
    ['has a BFD port', { bfdPortEnabled: true }, false],
  ])('should warn about BFD when the selected VPC %s', (_, selectedVpc, warning) => {
    expect(vpcBfdPortDisabled.call({ selectedVpc })).toBe(warning);
  });

  it('should not warn about BFD before a VPC is selected', () => {
    expect(vpcBfdPortDisabled.call({ selectedVpc: null })).toBe(false);
  });

  it('should link the BFD warning to the BFD Port tab of the selected VPC', () => {
    const selectedVpc = { detailLocation: { name: 'harvester-c-cluster-resource-id', params: { resource: 'kubeovn.io.vpc', id: 'commonvpc' } } };

    expect(vpcEditLocation.call({ selectedVpc })).toStrictEqual({
      name:   'harvester-c-cluster-resource-id',
      params: { resource: 'kubeovn.io.vpc', id: 'commonvpc' },
      query:  { mode: 'edit' },
      hash:   '#bfdPort',
    });
  });
});
