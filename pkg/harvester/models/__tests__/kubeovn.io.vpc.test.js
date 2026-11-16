import HciVPC from '../kubeovn.io.vpc';

jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));

function createVpc(spec) {
  return Object.assign(Object.create(HciVPC.prototype), { spec });
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
});
