import EditVPC from '../kubeovn.io.vpc/index.vue';

const { validateBfdPort, applyBfdPort } = EditVPC.methods;

const t = (key) => key;

function createContext(form = {}, spec = {}) {
  const value = { metadata: { name: 'commonvpc' }, spec };

  return {
    t,
    value,
    ...EditVPC.data.call({ value }),
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
