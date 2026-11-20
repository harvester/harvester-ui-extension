import EditVPC from '../kubeovn.io.vpc/index.vue';

const { validateBfdPort, bfdPortIPError, applyBfdPort } = EditVPC.methods;
const { validationPassed, gatewaysNeedingBfdPort } = EditVPC.computed;

const t = (key) => key;

function createContext(form = {}, spec = {}, model = {}) {
  const value = {
    metadata: { name: 'commonvpc' }, spec, subnetResources: [], bfdEgressGateways: [], ...model
  };

  return {
    t,
    value,
    ...EditVPC.data.call({ value }),
    bfdPortIPError,
    ...form,
  };
}

describe('edit: kubeovn.io.vpc', () => {
  it('should load the BFD port of an existing VPC', () => {
    const context = createContext({}, { bfdPort: { enabled: true, ip: '10.255.255.255' } });

    expect(context.bfdPortEnabled).toBe(true);
    expect(context.bfdPortIP).toBe('10.255.255.255');
  });

  it('should not add a BFD port to a VPC that has none while it stays disabled', () => {
    const context = createContext({}, { staticRoutes: [] });

    expect(validateBfdPort.call(context)).toStrictEqual([]);
    applyBfdPort.call(context);

    expect(context.value.spec).toStrictEqual({ staticRoutes: [] });
  });

  it('should enable the BFD port with its IP and keep its node selector', () => {
    const nodeSelector = { matchLabels: { 'kubernetes.io/os': 'linux' } };
    const context = createContext({ bfdPortEnabled: true, bfdPortIP: ' 10.255.255.255 , fd00::ffff ' }, { bfdPort: { enabled: false, nodeSelector } });

    expect(validateBfdPort.call(context)).toStrictEqual([]);
    applyBfdPort.call(context);

    expect(context.value.spec.bfdPort).toStrictEqual({
      enabled: true, ip: '10.255.255.255,fd00::ffff', nodeSelector
    });
  });

  it('should keep the IP when the BFD port is disabled', () => {
    const context = createContext({ bfdPortEnabled: false }, { bfdPort: { enabled: true, ip: '10.255.255.255' } });

    applyBfdPort.call(context);

    expect(context.value.spec.bfdPort).toStrictEqual({ enabled: false, ip: '10.255.255.255' });
  });

  it('should reject a BFD port IP inside one of the VPC subnets', () => {
    const subnet = {
      id: 'subnetinternal', spec: { cidrBlock: '172.20.10.0/24' }, containsIP: (ip) => ip.startsWith('172.20.10.')
    };
    const context = createContext({ bfdPortEnabled: true, bfdPortIP: '172.20.10.200' }, {}, { subnetResources: [subnet] });
    const errors = validateBfdPort.call(context);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('harvester.vpc.bfdPort.validation.subnet');
  });

  it.each([
    ['a name and a valid BFD port', {}, true],
    ['no name', { value: { metadata: {} } }, false],
    ['an invalid BFD port', { bfdPortErrors: ['error'] }, false],
  ])('should allow the save with %s', (_, form, passed) => {
    expect(validationPassed.call({
      value: { metadata: { name: 'commonvpc' } }, bfdPortErrors: [], ...form
    })).toBe(passed);
  });

  it('should list the gateways that need the BFD port only while it is disabled', () => {
    const bfdEgressGateways = [{ id: 'default/gateway1' }];

    expect(gatewaysNeedingBfdPort.call({ bfdPortEnabled: false, value: { bfdEgressGateways } })).toStrictEqual(bfdEgressGateways);
    expect(gatewaysNeedingBfdPort.call({ bfdPortEnabled: true, value: { bfdEgressGateways } })).toStrictEqual([]);
  });

  it.each([
    ['no IP', '', 'validation.required'],
    ['an invalid IP', '10.255.255.256', 'harvester.vpc.bfdPort.validation.ip'],
    ['a CIDR', '10.255.255.255/32', 'harvester.vpc.bfdPort.validation.ip'],
    ['two IPv4 addresses', '10.255.255.254,10.255.255.255', 'harvester.vpc.bfdPort.validation.ip'],
    ['three addresses', '10.255.255.255,fd00::1,fd00::2', 'harvester.vpc.bfdPort.validation.ip'],
  ])('should reject an enabled BFD port with %s', (_, bfdPortIP, errorKey) => {
    const errors = validateBfdPort.call(createContext({ bfdPortEnabled: true, bfdPortIP }));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(errorKey);
  });
});
