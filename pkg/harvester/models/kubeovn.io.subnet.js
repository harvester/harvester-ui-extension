import ipaddr from 'ipaddr.js';
import { clone } from '@shell/utils/object';
import { HCI } from '../types';
import HarvesterResource from './harvester';

const splitList = (value) => `${ value || '' }`.split(',').map((item) => item.trim()).filter(Boolean);
const parseIP = (ip) => {
  try {
    return ipaddr.parse(ip);
  } catch (e) {
    return null;
  }
};
const parseCIDR = (cidr) => {
  try {
    return ipaddr.parseCIDR(cidr);
  } catch (e) {
    return null;
  }
};

export default class HciSubnet extends HarvesterResource {
  get groupByVpc() {
    return this.spec?.vpc || '';
  }

  // The provider names the NetworkAttachmentDefinition the subnet is attached to, as <nad>.<namespace>
  // or <nad>.<namespace>.ovn. Kube-OVN's own subnets (join, ovn-default) use "ovn" and have none.
  get networkAttachment() {
    const [name, namespace, type, ...rest] = `${ this.spec?.provider || '' }`.split('.');

    if (!name || !namespace || rest.length || (type !== undefined && type !== 'ovn')) {
      return null;
    }

    return { name, namespace };
  }

  // Kube-OVN, as Harvester runs it (a secondary CNI), only puts a gateway's internal network on a
  // subnet whose provider is <nad>.<namespace>.ovn
  get isOverlayAttachment() {
    return !!this.networkAttachment && `${ this.spec?.provider }`.endsWith('.ovn');
  }

  containsIP(ip) {
    const address = parseIP(ip);

    return !!address && splitList(this.spec?.cidrBlock).map(parseCIDR).some((range) => range?.[0].kind() === address.kind() && address.match(range));
  }

  // Kube-OVN only assigns a static IP that is inside the subnet's CIDR of its family and isn't the gateway
  canAssignIP(ip) {
    const address = parseIP(ip);
    const isGateway = splitList(this.spec?.gateway).map(parseIP).some((gateway) => gateway?.kind() === address?.kind() && gateway.toNormalizedString() === address.toNormalizedString());

    return this.containsIP(ip) && !isGateway;
  }

  get doneOverride() {
    const detailLocation = clone(this.listLocation);

    detailLocation.params.resource = HCI.VPC;

    return detailLocation;
  }

  get parentLocationOverride() {
    return {
      ...this.listLocation,
      params: {
        ...this.listLocation.params,
        resource: HCI.VPC
      }
    };
  }
}
