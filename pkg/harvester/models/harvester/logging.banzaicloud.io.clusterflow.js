import { clone } from '@shell/utils/object';
import { LOGGING } from '@shell/config/types';
import { HCI } from '../../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';
import HarvesterFlow from './logging.banzaicloud.io.flow';

export default class HciClusterflow extends HarvesterFlow {
  get allOutputs() {
    return this.$rootGetters['harvester/all'](LOGGING.CLUSTER_OUTPUT) || [];
  }

  get listLocation() {
    const listLocation = clone(super.listLocation);

    listLocation.name = this.harvesterResourcesInExplorer ? 'c-cluster-product-resource' : `${ HARVESTER_PRODUCT }-c-cluster-resource`;
    listLocation.params.resource = HCI.CLUSTER_FLOW;

    return listLocation;
  }

  get harvesterResourcesInExplorer() {
    return this.$rootGetters['productId'] !== HARVESTER_PRODUCT;
  }

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

  get detailLocation() {
    const detailLocation = clone(this._detailLocation);

    detailLocation.params.resource = HCI.CLUSTER_FLOW;

    return detailLocation;
  }

  get doneOverride() {
    const detailLocation = clone(this._detailLocation);

    delete detailLocation.params.namespace;
    delete detailLocation.params.id;
    detailLocation.params.resource = HCI.CLUSTER_FLOW;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource`;

    return detailLocation;
  }

  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.CLUSTER_FLOW }"`, { count: 1 })?.trim();
  }

  get parentLocationOverride() {
    return this.doneOverride;
  }
}
