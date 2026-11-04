//@ts-nocheck
import { addParams } from '@shell/utils/url';
import { HCI } from '../../types';
import { BACKUP_TYPE } from '../../config/types';
import { HCI as HCI_ANNOTATIONS } from '../../config/labels-annotations';

// ---------------------------------------------------------------------------
// Side navigation counts
//
// The side navigation (`Type.vue`, `type-map/getTree`) shows the number of
// resources of a nav item by calling `harvester/count({ name: <nav item> })`.
// Many Harvester nav items are named differently than the K8s resource they
// list (e.g. `harvesterhci.io.volume` lists `persistentvolumeclaim`, see
// `configureType(..., { resource })` in config/harvester-cluster.js). Some
// list views additionally show only a subset of that resource type.
//
// All counts come from the server: Steve's counts endpoint for nav items
// listing all resources of a type, and a filtered request with a page size of 1
// for the nav items in SERVER_FILTERED_COUNTS. Resource lists are not loaded
// for the counts.
// ---------------------------------------------------------------------------

/**
 * Nav items whose list view shows only a subset of the underlying resource
 * type, with the query parameters of that subset. Each query must match the
 * filter of the list view, so keep them in sync with the files in list/.
 *
 * Steve's counts endpoint only knows the total per resource type, so these
 * counts are requested from Harvester's API (`/v1/harvester`) with the query
 * and a page size of 1: the `count` of the response is the number of matches
 * (see `fetchFilteredCounts` in actions.ts).
 *
 * The queries rely on the filtering of Harvester's API, which does not use
 * Steve's SQL cache: `filter=a.b=c` matches when the field contains the value,
 * `filter=a.b!=` when the field is not set, and a list field matches when any
 * of its items matches. Rewrite them when Harvester's API moves to the SQL
 * cache: it only filters on indexed fields, and it ignores `labelSelector`
 * without an error, so these counts would silently become the totals.
 */
export const SERVER_FILTERED_COUNTS: Record<string, Record<string, string>> = {
  // VM backups and VM snapshots are both VirtualMachineBackup resources
  [HCI.BACKUP]:             { filter: `spec.type!=${ BACKUP_TYPE.SNAPSHOT }` },
  [HCI.VM_SNAPSHOT]:        { filter: `spec.type=${ BACKUP_TYPE.SNAPSHOT }` },
  // VM backups and snapshots also create VolumeSnapshots, owned by the VirtualMachineBackup
  [HCI.SNAPSHOT]:           { filter: 'metadata.ownerReferences.kind=PersistentVolumeClaim' },
  // Every VM image creates an internal backing image StorageClass
  [HCI.STORAGE]:            { filter: 'parameters.backingImage!=' },
  // Only ConfigMaps labeled as cloud-init template
  [HCI.CLOUD_TEMPLATE]:     { labelSelector: HCI_ANNOTATIONS.CLOUD_INIT },
  // Hides the storage network, which always has this label next to its annotation
  [HCI.NETWORK_ATTACHMENT]: { labelSelector: `!${ HCI_ANNOTATIONS.STORAGE_NETWORK_HASH }` },
};

/**
 * Nav items without a count. The list of Volumes hides golden image and CDI
 * populator volumes, which are only marked by annotations: Harvester's API
 * cannot filter on these, and the total of the counts endpoint would be wrong.
 */
export const NO_COUNT = new Set<string>([
  HCI.VOLUME,
]);

/**
 * Nav items whose list view lists the resources of all namespaces whatever the
 * namespace filter is (`:ignore-filter="true"` or `:namespaced="false"` on
 * `ResourceTable`). Keep in sync with the files in list/.
 */
export const IGNORE_NAMESPACE_FILTER = new Set<string>([
  HCI.NETWORK_ATTACHMENT,
  HCI.CLUSTER_FLOW,
  HCI.CLUSTER_OUTPUT,
  HCI.FLOW,
  HCI.OUTPUT,
  HCI.ADD_ONS,
]);

/**
 * The namespaces to count for a namespaced resource type, or `null` to count
 * all of them. Mirrors the namespace filter of `ResourceTable`: even with
 * "All Namespaces" selected, the Harvester product (`hideSystemResources`)
 * does not list resources in system namespaces, e.g. the PVCs of
 * cattle-monitoring-system.
 */
export function countedNamespaces(rootGetters: any): string[] | null {
  if (rootGetters.isAllNamespaces && !rootGetters.currentProduct?.hideSystemResources) {
    return null;
  }

  // `namespaces()` computes the active namespaces on demand, so a count is available right
  // away instead of only once something else has triggered that computation.
  // An empty result is a valid selection (e.g. a project without namespaces): keep the
  // empty array so that nothing is counted instead of the cluster-wide total.
  return Object.keys(rootGetters.namespaces());
}

/**
 * Whether the count of a nav item depends on the namespace filter.
 */
export function isFilteredByNamespace(name: string, schema: any): boolean {
  return !!schema?.attributes?.namespaced && !IGNORE_NAMESPACE_FILTER.has(name);
}

/**
 * The request for the count of a nav item in SERVER_FILTERED_COUNTS:
 * - `{ url }` to request it,
 * - `{ count: 0 }` if nothing can match (no namespace selected),
 * - `null` if the resource type is unknown or cannot be listed.
 */
export function filteredCountRequest(getters: any, rootGetters: any, name: string): { url?: string, count?: number } | null {
  const schema = getters.schemaFor(name);

  if (!schema?.links?.collection) {
    return null;
  }

  const params: Record<string, string> = { ...SERVER_FILTERED_COUNTS[name], pagesize: '1' };

  if (isFilteredByNamespace(name, schema)) {
    const namespaces = countedNamespaces(rootGetters);

    if (namespaces?.length === 0) {
      return { count: 0 };
    }

    if (namespaces) {
      params.projectsornamespaces = namespaces.join(',');
    }
  }

  return { url: addParams(getters.urlFor(schema.id), params) };
}
