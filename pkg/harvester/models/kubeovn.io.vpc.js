import { clone } from '@shell/utils/object';
import { HCI } from '../types';
import HarvesterResource from './harvester';

// Kube-OVN's cluster router, which a gateway without spec.vpc uses
const DEFAULT_VPC = 'ovn-cluster';

export default class HciVPC extends HarvesterResource {
  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.VPC }"`, { count: 1 })?.trim();
  }

  get doneOverride() {
    const detailLocation = clone(this.listLocation);

    detailLocation.params.resource = HCI.VPC;

    return detailLocation;
  }

  get subnetResources() {
    return (this.$getters['all'](HCI.SUBNET) || []).filter((subnet) => subnet.spec?.vpc === this.metadata?.name);
  }

  // The Egress Gateways of this VPC that have BFD on, which need its BFD port
  get bfdEgressGateways() {
    if (!this.$getters['schemaFor'](HCI.VPC_EGRESS_GATEWAY)) {
      return [];
    }

    return (this.$getters['all'](HCI.VPC_EGRESS_GATEWAY) || [])
      .filter((gateway) => (gateway.spec?.vpc || DEFAULT_VPC) === this.metadata?.name && gateway.spec?.bfd?.enabled);
  }

  get bfdPortEnabled() {
    const bfdPort = this.spec?.bfdPort;

    return bfdPort?.enabled === true && !!`${ bfdPort.ip || '' }`.trim();
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
