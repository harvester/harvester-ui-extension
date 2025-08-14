import { clone } from '@shell/utils/object';
import { HCI } from '../../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';
import LogOutput from './logging.banzaicloud.io.output';

export default class HciClusteroutput extends LogOutput {
  get _detailLocation() {
    const schema = this.$getters['schemaFor'](this.type);

    const id = this.id?.replace(/.*\//, '');

    return {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource${ schema?.attributes?.namespaced ? '-namespace' : '' }-id`,
      params: {
        product:   HARVESTER_PRODUCT,
        cluster:   this.$rootGetters['clusterId'],
        resource:  this.type,
        id,
        namespace: this.metadata.namespace,
      },
    };
  }

  get listLocation() {
    const listLocation = clone(super.listLocation);

    listLocation.name = this.harvesterResourcesInExplorer ? 'c-cluster-product-resource' : `${ HARVESTER_PRODUCT }-c-cluster-resource`;
    listLocation.params.resource = HCI.CLUSTER_OUTPUT;

    return listLocation;
  }

  get harvesterResourcesInExplorer() {
    return this.$rootGetters['productId'] !== HARVESTER_PRODUCT;
  }

  get detailLocation() {
    const detailLocation = clone(this._detailLocation);

    detailLocation.params.resource = HCI.CLUSTER_OUTPUT;

    return detailLocation;
  }

  get doneOverride() {
    const detailLocation = clone(this._detailLocation);

    delete detailLocation.params.namespace;
    delete detailLocation.params.id;
    detailLocation.params.resource = HCI.CLUSTER_OUTPUT;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource`;

    return detailLocation;
  }

  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.CLUSTER_OUTPUT }"`, { count: 1 })?.trim();
  }

  get parentLocationOverride() {
    return this.doneOverride;
  }
}
