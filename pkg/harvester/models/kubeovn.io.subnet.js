import { clone } from '@shell/utils/object';
import { HCI } from '../types';
import HarvesterResource from './harvester';

export default class HciSubnet extends HarvesterResource {
  get listLocation() {
    const listLocation = clone(super.listLocation);

    listLocation.params.resource = HCI.VPC;

    return listLocation;
  }

  get groupByVpc() {
    return this.spec?.vpc || '';
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
