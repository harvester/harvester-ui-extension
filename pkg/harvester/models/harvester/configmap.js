// This file is Cloud Configuration Templates page model
import { clone } from '@shell/utils/object';
import { HCI } from '../../types';
import HarvesterResource from '../harvester';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';

export default class HciConfigMap extends HarvesterResource {
  get listLocation() {
    const listLocation = clone(super.listLocation);

    listLocation.params.resource = HCI.CLOUD_TEMPLATE;

    return listLocation;
  }

  get detailLocation() {
    const detailLocation = clone(this._detailLocation);

    detailLocation.params.resource = HCI.CLOUD_TEMPLATE;

    return detailLocation;
  }

  get doneOverride() {
    const detailLocation = clone(this._detailLocation);

    delete detailLocation.params.namespace;
    delete detailLocation.params.id;
    detailLocation.params.resource = HCI.CLOUD_TEMPLATE;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource`;

    return detailLocation;
  }

  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.CLOUD_TEMPLATE }"`, { count: 1 })?.trim();
  }

  get parentLocationOverride() {
    return this.doneOverride;
  }
}
