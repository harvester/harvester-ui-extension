import { isValidCIDR } from '../regular';

describe('isValidCIDR', () => {
  it.each([
    '10.0.0.0/16',
    '192.168.1.0/24',
    '0.0.0.0/0',
    '255.255.255.255/32',
  ])('should accept the IPv4 CIDR %s', (cidr) => {
    expect(isValidCIDR(cidr)).toBe(true);
  });

  it.each([
    ['a short form', '10.1/16'],
    ['a single number', '10/8'],
    ['an integer address', '167772160/8'],
    ['a hex address', '0x0a.0.0.0/8'],
    ['an extra part', '10.0.0.0/24/1'],
    ['an IPv6 range', 'fd00::/64'],
    ['an IPv4-mapped IPv6 range', '::ffff:10.0.0.0/120'],
    ['a prefix over 32', '10.0.0.0/33'],
    ['an octet over 255', '10.0.0.256/24'],
    ['no prefix', '10.0.0.0'],
    ['an empty value', ''],
  ])('should reject %s (%s)', (_, cidr) => {
    expect(isValidCIDR(cidr)).toBe(false);
  });
});
