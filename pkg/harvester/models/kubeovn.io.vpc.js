import { clone } from '@shell/utils/object';
import { HCI } from '../types';
import HarvesterResource from './harvester';

export default class HciVPC extends HarvesterResource {
  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.VPC }"`, { count: 1 })?.trim();
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
