import HciSubnet from '../kubeovn.io.subnet';

jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));

function createSubnet(spec) {
  return Object.assign(Object.create(HciSubnet.prototype), { spec });
}

describe('class HciSubnet', () => {
  it.each([
    ['ovn', null, false],
    ['', null, false],
    ['vmnet.default.ovn', { name: 'vmnet', namespace: 'default' }, true],
    ['extnet.default', { name: 'extnet', namespace: 'default' }, false],
    ['extnet.default.other', null, false],
    ['a.b.ovn.extra', null, false],
  ])('should read the network attachment of provider "%s"', (provider, attachment, overlay) => {
    const subnet = createSubnet({ provider });

    expect(subnet.networkAttachment).toStrictEqual(attachment);
    expect(subnet.isOverlayAttachment).toBe(overlay);
  });

  it.each([
    ['172.20.10.41', true],
    ['172.20.10.1', false],
    ['172.20.10.0', false],
    ['172.20.10.255', false],
    ['172.20.10.254', true],
    ['172.20.11.1', false],
    ['fd00::10', true],
    ['fd00::1', false],
    ['fd00::', false],
    ['fd00::ff', false],
    ['fd01::10', false],
    ['not-an-ip', false],
  ])('should tell whether %s can be assigned in a dual-stack subnet', (ip, assignable) => {
    const subnet = createSubnet({ cidrBlock: '172.20.10.0/24,fd00::/120', gateway: '172.20.10.1,fd00::1' });

    expect(subnet.canAssignIP(ip)).toBe(assignable);
  });

  it('should tell whether the subnet contains an IP, its gateway included', () => {
    const subnet = createSubnet({ cidrBlock: '172.20.10.0/24', gateway: '172.20.10.1' });

    expect(subnet.containsIP('172.20.10.1')).toBe(true);
    expect(subnet.containsIP('10.255.255.255')).toBe(false);
  });

  it.each([
    ['10.0.0.0/31', '10.0.0.0', true],
    ['10.0.0.0/31', '10.0.0.1', true],
    ['10.0.0.5/32', '10.0.0.5', true],
  ])('should use every address of a point-to-point subnet %s', (cidrBlock, ip, assignable) => {
    expect(createSubnet({ cidrBlock }).canAssignIP(ip)).toBe(assignable);
  });
});
