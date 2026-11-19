import { isIpv4 } from '@shell/utils/string';
import { isValidIP } from '@shell/utils/validators/cidr';
import HarvesterResource from './harvester';

// The kubeovn-operator keeps a single Configuration; the BGP speaker reads its spec.bgp
export const KUBEOVN_CONFIGURATION_ID = 'kube-system/kubeovn';

// Values Harvester installs before anyone sets up BGP. The addresses are documentation addresses, never a real neighbor.
const PLACEHOLDER_AS = { neighborAS: 64512, clusterAS: 64513 };
const PLACEHOLDER_NEIGHBORS = ['192.0.2.1', '2001:db8::1'];

// spec.bgp keeps its lists as comma-separated strings
const splitList = (value) => `${ value || '' }`.split(',').map((item) => item.trim()).filter(Boolean);

export const isIpv6 = (ip) => isValidIP(ip) && !isIpv4(ip);

export const isPlaceholderNeighbor = (ip) => PLACEHOLDER_NEIGHBORS.includes(`${ ip || '' }`.trim());

// The speaker parses its addresses with Go, which rejects an IPv4 part written with a leading zero (192.0.2.010), so
// the speaker would not start. Returns the address without those zeros, or null when it has none. An IPv6 address
// can end in an IPv4 one (::ffff:10.0.0.1), so only its dotted tail is checked.
export const withoutLeadingZeros = (ip) => {
  const value = `${ ip || '' }`.trim();
  const tailStart = value.lastIndexOf(':') + 1;
  const parts = value.slice(tailStart).split('.');

  if (parts.length !== 4 || !parts.some((part) => /^0\d/.test(part))) {
    return null;
  }

  return value.slice(0, tailStart) + parts.map((part) => part.replace(/^0+(?=\d)/, '')).join('.');
};

export default class KubeOvnConfiguration extends HarvesterResource {
  get bgp() {
    return this.spec?.bgp || {};
  }

  // The speaker only runs on these hosts: none means BGP is off
  get bgpSpeakerHosts() {
    return splitList(this.bgp.nodeNames);
  }

  // The placeholder neighbors are left out: they are never a real BGP router
  get bgpNeighborsV4() {
    return splitList(this.bgp.neighborV4Address).filter((ip) => !isPlaceholderNeighbor(ip));
  }

  get bgpNeighborsV6() {
    return splitList(this.bgp.neighborV6Address).filter((ip) => !isPlaceholderNeighbor(ip));
  }

  get bgpNeighbors() {
    return [...this.bgpNeighborsV4, ...this.bgpNeighborsV6];
  }

  get bgpNextHops() {
    return splitList(this.bgp.nextHops);
  }

  // Nobody has set up BGP yet: only the values Harvester installs. A speaker that was set up and then disabled keeps
  // its neighbors, so it never matches, even when its AS numbers happen to be the placeholder ones (they are private
  // AS numbers anyone can pick).
  get bgpUntouched() {
    const bgp = this.bgp;

    return !this.bgpSpeakerHosts.length &&
      !this.bgpNeighbors.length &&
      !bgp.routerID &&
      !this.bgpNextHops.length &&
      bgp.neighborAS === PLACEHOLDER_AS.neighborAS &&
      bgp.clusterAS === PLACEHOLDER_AS.clusterAS;
  }
}
