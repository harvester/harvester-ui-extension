import HarvesterResource from './harvester';

export default class ForkliftPlan extends HarvesterResource {
  /**
   * Deleting a Plan cascades via ownerReferences set at creation time.
   * Kubernetes GC will automatically delete: Migration, NetworkMap, StorageMap, Provider (→ Secret).
   * Use foreground propagation to ensure children are deleted before the parent.
   */
  remove() {
    const opt = { ...arguments };

    opt.params = { propagationPolicy: 'Foreground' };

    return this._remove(opt);
  }
}
