import HarvesterResource from './harvester';

export default class ForkliftProvider extends HarvesterResource {
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
