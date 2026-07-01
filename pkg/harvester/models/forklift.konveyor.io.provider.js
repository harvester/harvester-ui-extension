import HarvesterResource from './harvester';
import { PRODUCT_NAME } from '../config/harvester';

export default class ForkliftProvider extends HarvesterResource {
  get _createLocation() {
    return {
      name:   `${ PRODUCT_NAME }-c-cluster-vm-migration-provider-wizard`,
      params: {
        product: this.$rootGetters['productId'],
        cluster: this.$rootGetters['clusterId'],
      }
    };
  }

  get _editLocation() {
    return {
      name:   `${ PRODUCT_NAME }-c-cluster-vm-migration-provider-wizard`,
      params: {
        product: this.$rootGetters['productId'],
        cluster: this.$rootGetters['clusterId'],
      },
      query: { providerId: `${ this.metadata.namespace }/${ this.metadata.name }` },
    };
  }

  /**
   * Deleting a Provider cascades via ownerReferences set at creation time.
   * Kubernetes GC will automatically delete: Secret, NetworkMap, StorageMap.
   * Use foreground propagation to ensure children are deleted before the parent.
   */
  remove() {
    const opt = { ...arguments };

    opt.params = { propagationPolicy: 'Foreground' };

    return this._remove(opt);
  }
}
