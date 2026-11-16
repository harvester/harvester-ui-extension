import { isIpv4 } from '@shell/utils/string';
import { isValidIP } from '@shell/utils/validators/cidr';
import HarvesterResource from './harvester';

// The kubeovn-operator keeps a single Configuration; the BGP speaker reads its spec.bgp
export const KUBEOVN_CONFIGURATION_ID = 'kube-system/kubeovn';

// Values Harvester installs before anyone sets up BGP. The addresses are documentation addresses, never a real neighbor.
export const PLACEHOLDER_NEIGHBORS = ['192.0.2.1', '2001:db8::1'];
export const PLACEHOLDER_AS = { neighborAS: 64512, clusterAS: 64513 };

// spec.bgp keeps its lists as comma-separated strings
export const splitList = (value) => `${ value || '' }`.split(',').map((item) => item.trim()).filter(Boolean);
export const isIpv6 = (ip) => isValidIP(ip) && !isIpv4(ip);

export default class KubeOvnConfiguration extends HarvesterResource {
  get bgp() {
    return this.spec?.bgp || {};
  }

  // The speaker only runs on these hosts: none means BGP is off
  get bgpSpeakerHosts() {
    return splitList(this.bgp.nodeNames);
  }

  get bgpNeighbors() {
    return [...splitList(this.bgp.neighborV4Address), ...splitList(this.bgp.neighborV6Address)]
      .filter((ip) => !PLACEHOLDER_NEIGHBORS.includes(ip));
  }

  get bgpNextHops() {
    return splitList(this.bgp.nextHops);
  }
}
