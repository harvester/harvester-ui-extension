import EditVpcEgressGateway from '../kubeovn.io.vpcegressgateway.vue';

const {
  validate, validateTabs, ipError, ipCountError, policyError, policiesSpec, toSpec, bfdSpec, saveGateway
} = EditVpcEgressGateway.methods;
const { vpc: onVpcChange, externalNetworkMode: onExternalNetworkModeChange } = EditVpcEgressGateway.watch;
const {
  showExternalNetworkMode, vpcBfdPortDisabled, vpcEditLocation, internalSubnetOptions, externalSubnetOptions, externalSubnetRules, internalSubnetPlaceholder, snatSubnetOptions, noSnatSubnetOptions, policySubnetsPlaceholder
} = EditVpcEgressGateway.computed;
const { requiredError } = EditVpcEgressGateway.methods;

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
    snatSubnets:    ['subnetinternal'],
    ...form,
  };

  Object.assign(context, {
    bfdSpec, validateTabs, ipError, ipCountError, policyError, policiesSpec
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
  it('should start a new gateway with one replica, no subnets and BFD off', () => {
    const data = EditVpcEgressGateway.data.call({ value: { metadata: {} } });

    expect(data.replicas).toBe(1);
    expect([data.snatSubnets, data.noSnatSubnets, data.ipBlockPolicies]).toStrictEqual([[], [], []]);
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
      snatSubnets:      [],
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

  it.each([
    ['empty', '', 'validation.required'],
    ['the internal subnet', 'subnetinternal', 'harvester.egressGateway.validation.sameSubnet'],
  ])('should explain an external subnet that is %s', (_, value, errorKey) => {
    const [rule] = externalSubnetRules.call(createContext({ requiredError }));

    expect(rule(value)).toContain(errorKey);
  });

  it('should accept an external subnet other than the internal one', () => {
    const [rule] = externalSubnetRules.call(createContext({ requiredError }));

    expect(rule('subnetexternal')).toBeUndefined();
  });

  it('should ask for a VPC before the internal subnet', () => {
    expect(internalSubnetPlaceholder.call({
      t: (key) => key, vpc: '', internalSubnetOptions: []
    })).toBe('harvester.egressGateway.internalSubnet.noVpc');
  });

  it('should say when the VPC has no subnet on a virtual machine network', () => {
    const t = (key, args) => (args ? `${ key } ${ args.vpc }` : key);

    expect(internalSubnetPlaceholder.call({
      t, vpc: 'ovn-cluster', internalSubnetOptions: []
    })).toBe('harvester.egressGateway.internalSubnet.none ovn-cluster');
    expect(internalSubnetPlaceholder.call({
      t, vpc: 'commonvpc', internalSubnetOptions: [{ value: 'subnetinternal' }]
    })).toBe('harvester.egressGateway.internalSubnet.placeholder');
  });

  it('should leave an empty IP row to the save, which drops it', () => {
    expect(ipError.call(createContext(), 'internalIPs', ' ')).toBeUndefined();
  });

  it('should read the policies as Kube-OVN applies them', () => {
    const data = EditVpcEgressGateway.data.call({
      value: {
        spec: {
          policies: [
            { snat: true, subnets: ['a', 'b'] },
            { snat: true, subnets: ['c', 'a'] },
            { snat: false, subnets: ['b', 'd'] },
            { snat: false, ipBlocks: ['10.0.0.0/24'] },
          ]
        }
      }
    });

    expect(data.snatSubnets).toStrictEqual(['a', 'c']);
    expect(data.noSnatSubnets).toStrictEqual(['b', 'd']);
    expect(data.ipBlockPolicies).toStrictEqual([{ snat: false, ipBlocks: ['10.0.0.0/24'] }]);
  });

  it('should write one policy for each group and keep the IP block policies', () => {
    const context = createContext({
      snatSubnets: ['a', 'c'], noSnatSubnets: ['b'], ipBlockPolicies: [{ snat: true, ipBlocks: ['10.0.0.0/24'] }]
    });

    expect(policiesSpec.call(context)).toStrictEqual([
      { snat: true, subnets: ['a', 'c'] },
      { snat: false, subnets: ['b'] },
      { snat: true, ipBlocks: ['10.0.0.0/24'] },
    ]);
  });

  it('should leave out a group without subnets', () => {
    expect(policiesSpec.call(createContext({ snatSubnets: [], noSnatSubnets: ['b'] }))).toStrictEqual([{ snat: false, subnets: ['b'] }]);
  });

  it.each([
    ['no VPC is chosen', '', [], 'harvester.egressGateway.policies.noVpc'],
    ['the VPC has no subnets', 'emptyvpc', [], 'harvester.egressGateway.policies.noSubnets emptyvpc'],
    ['the VPC has subnets', 'commonvpc', [{ value: 'a' }], 'harvester.egressGateway.policies.placeholder'],
  ])('should explain the policy lists when %s', (_, vpc, vpcSubnetOptions, placeholder) => {
    const t = (key, args) => (args ? `${ key } ${ args.vpc }` : key);

    expect(policySubnetsPlaceholder.call({
      t, vpc, vpcSubnetOptions
    })).toBe(placeholder);
  });

  it('should not offer a subnet of one group in the other, nor the external subnet', () => {
    const vpcSubnetOptions = ['a', 'b', 'c', 'ext'].map((value) => ({ label: value, value }));
    const context = {
      vpcSubnetOptions, snatSubnets: ['a'], noSnatSubnets: ['b'], externalSubnet: 'ext'
    };

    expect(snatSubnetOptions.call(context).map((option) => option.value)).toStrictEqual(['a', 'c']);
    expect(noSnatSubnetOptions.call(context).map((option) => option.value)).toStrictEqual(['b', 'c']);
  });

  it('should reject the external subnet as a policy source', () => {
    const error = policyError.call(createContext({ snatSubnets: ['subnetexternal'] }));

    expect(error).toContain('harvester.egressGateway.validation.policyExternalSubnet');
    expect(error).toContain('subnetexternal');
  });

  it.each([
    ['subnets with SNAT', { snatSubnets: ['a'] }],
    ['subnets without SNAT', { snatSubnets: [], noSnatSubnets: ['b'] }],
    ['only IP blocks', { snatSubnets: [], ipBlockPolicies: [{ snat: false, ipBlocks: ['10.0.0.0/24'] }] }],
  ])('should accept a gateway with %s', (_, form) => {
    expect(policyError.call(createContext(form))).toBeUndefined();
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
    const context = createContext({ snatSubnets: [] }, existing);
    const { snatSubnets, noSnatSubnets, ipBlockPolicies } = EditVpcEgressGateway.data.call({ value: context.value });

    Object.assign(context, {
      snatSubnets, noSnatSubnets, ipBlockPolicies
    });

    const spec = toSpec.call(context);

    expect(spec.trafficPolicy).toBe('Local');
    expect(spec.selectors).toStrictEqual(existing.selectors);
    expect(spec.policies).toStrictEqual([{ snat: false, ipBlocks: ['10.0.0.0/24'] }]);
    expect(validate.call(context)).toStrictEqual([]);
  });

  it.each([
    ['has', true],
    ['does not have', false],
  ])('should offer Primary CNI when the CRD %s externalNetworkMode', async(_, hasField) => {
    const schema = { fetchResourceFields: jest.fn().mockResolvedValue({}) };
    const getters = {
      currentProduct:                 { inStore: 'harvester' },
      'harvester/schemaFor':          () => schema,
      'harvester/pathExistsInSchema': jest.fn(() => hasField),
    };
    const context = { $store: { getters, dispatch: jest.fn().mockResolvedValue([]) }, supportsPrimaryCNI: false };

    await EditVpcEgressGateway.fetch.call(context);

    expect(schema.fetchResourceFields).toHaveBeenCalledWith();
    expect(getters['harvester/pathExistsInSchema']).toHaveBeenCalledWith('kubeovn.io.vpcegressgateway', 'spec.externalNetworkMode');
    expect(context.supportsPrimaryCNI).toBe(hasField);
  });

  it.each([
    ['a CRD with the mode', { supportsPrimaryCNI: true, usesPrimaryCNI: false }, true],
    ['a CRD without the mode', { supportsPrimaryCNI: false, usesPrimaryCNI: false }, false],
    ['an existing Primary CNI gateway', { supportsPrimaryCNI: false, usesPrimaryCNI: true }, true],
  ])('should show the external network choice for %s', (_, context, shown) => {
    expect(showExternalNetworkMode.call(context)).toBe(shown);
  });

  it('should start a new gateway on an external subnet and leave the mode to the CRD default', () => {
    const context = createContext();

    expect(context.externalNetworkMode).toBe('Attachment');
    expect(toSpec.call(context)).not.toHaveProperty('externalNetworkMode');
  });

  it('should write a PrimaryCNI gateway without an external subnet', () => {
    const spec = toSpec.call(createContext({ externalNetworkMode: 'PrimaryCNI', externalSubnet: '' }));

    expect(spec.externalNetworkMode).toBe('PrimaryCNI');
    expect(spec).not.toHaveProperty('externalSubnet');
    expect(spec).not.toHaveProperty('externalIPs');
    expect(spec).not.toHaveProperty('bandwidth');
  });

  it('should clear the external fields when PrimaryCNI is chosen', () => {
    const context = createContext({
      externalIPs: ['10.115.48.220'], bandwidthIngress: 10, bandwidthEgress: '1Gi'
    });

    onExternalNetworkModeChange.call(context, 'PrimaryCNI');

    expect([context.externalSubnet, context.externalIPs, context.bandwidthIngress, context.bandwidthEgress]).toStrictEqual(['', [], '', '']);
  });

  it('should save a PrimaryCNI gateway made outside the form', () => {
    const existing = {
      vpc:                 'commonvpc',
      replicas:            1,
      externalNetworkMode: 'PrimaryCNI',
      internalSubnet:      'subnetinternal',
      policies:            [{ snat: true, subnets: ['subnetinternal'] }],
    };
    const value = { metadata: { name: 'gateway1', namespace: 'default' }, spec: existing };
    const context = createContext(EditVpcEgressGateway.data.call({ value }), existing);

    expect(context.externalNetworkMode).toBe('PrimaryCNI');
    expect(validate.call(context)).toStrictEqual([]);
    expect(toSpec.call(context)).toStrictEqual({
      ...existing,
      bfd: {
        enabled: false, minRX: 1000, minTX: 1000, multiplier: 3
      },
    });
  });

  it('should accept a complete form', () => {
    expect(validate.call(createContext())).toStrictEqual([]);
  });

  it.each([
    ['no VPC', { vpc: '' }, 'validation.required'],
    ['no internal subnet', { internalSubnet: '' }, 'validation.required'],
    ['no external subnet', { externalSubnet: '' }, 'validation.required'],
    ['the same internal and external subnet', { externalSubnet: 'subnetinternal', snatSubnets: ['subnetother'] }, 'harvester.egressGateway.validation.sameSubnet'],
    ['too many replicas', { replicas: 11 }, 'harvester.egressGateway.validation.replicas'],
    ['no subnet with or without SNAT', { snatSubnets: [] }, 'harvester.egressGateway.validation.policyRequired'],
    ['an invalid IP', { externalIPs: ['10.115.48.300', '10.115.48.221'] }, 'harvester.egressGateway.validation.ipList'],
    ['fewer IPs than replicas', { internalIPs: ['172.20.10.41'] }, 'harvester.egressGateway.validation.ipCount'],
    ['a repeated IP', { externalIPs: ['10.115.48.220', ' 10.115.48.220'] }, 'harvester.egressGateway.validation.ipDuplicate'],
    ['a BFD interval of 0', {
      bfd: {
        enabled: true, minRX: 0, minTX: 50, multiplier: 3
      }
    }, 'harvester.egressGateway.validation.bfd'],
    ['a BFD multiplier of 0', {
      bfd: {
        enabled: true, minRX: 50, minTX: 50, multiplier: 0
      }
    }, 'harvester.egressGateway.validation.bfdMultiplier'],
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
      snatSubnets:           ['subnetinternal', 'othersubnet'],
      noSnatSubnets:         ['subnetinternal'],
      vpcSubnetOptions:      [{ label: 'othersubnet', value: 'othersubnet' }],
      internalSubnetOptions: [{ label: 'othersubnet', value: 'othersubnet' }],
    });

    onVpcChange.call(context, 'othervpc', 'commonvpc');

    expect(context.internalSubnet).toBe('');
    expect(context.snatSubnets).toStrictEqual(['othersubnet']);
    expect(context.noSnatSubnets).toStrictEqual([]);
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
