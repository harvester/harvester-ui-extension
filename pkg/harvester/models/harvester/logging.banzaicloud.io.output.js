import { clone } from '@shell/utils/object';
import LogOutput from '@shell/models/logging.banzaicloud.io.output';
import { HCI } from '../../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';
import { FLOW_TYPE } from '../../config/harvester-map';

export default class HarvesterLogOutput extends LogOutput {
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
    listLocation.params.resource = HCI.OUTPUT;

    return listLocation;
  }

  get harvesterResourcesInExplorer() {
    return this.$rootGetters['productId'] !== HARVESTER_PRODUCT;
  }

  get detailLocation() {
    const detailLocation = clone(this._detailLocation);

    detailLocation.params.resource = HCI.OUTPUT;

    return detailLocation;
  }

  get doneOverride() {
    const detailLocation = clone(this._detailLocation);

    delete detailLocation.params.namespace;
    delete detailLocation.params.id;
    detailLocation.params.resource = HCI.OUTPUT;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource`;

    return detailLocation;
  }

  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.OUTPUT }"`, { count: 1 })?.trim();
  }

  get parentLocationOverride() {
    return this.doneOverride;
  }

  get url() {
    return this.detailLocation;
  }

  get loggingType() {
    if (this.spec.loggingRef === 'harvester-kube-audit-log-ref') {
      return FLOW_TYPE.AUDIT;
    }

    return FLOW_TYPE.LOGGING;
  }
}
