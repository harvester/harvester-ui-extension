//@ts-nocheck
import {
  NAMESPACE_FILTER_KINDS,
  NAMESPACE_FILTER_ALL as ALL,
  NAMESPACE_FILTER_ALL_ORPHANS as ALL_ORPHANS,
} from '@shell/utils/namespace-filter';
import { COUNT, MANAGEMENT, NAMESPACE } from '@shell/config/types';
import { sortBy } from '@shell/utils/sort';
import { filterBy } from '@shell/utils/array';
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
  // Hides the storage network: Harvester creates it with this generated name, and its annotation cannot be filtered on
  [HCI.NETWORK_ATTACHMENT]: { filter: 'metadata.generateName!=storagenetwork-' },
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

/**
 * Count of all resources of `resourceType`, taken from Steve's counts
 * endpoint. It is loaded with the cluster, so the count is available right
 * away. `null` if the resource type is unknown.
 */
function unfilteredCount(getters: any, resourceType: string, namespaces: string[] | null): number | null {
  const count = getters.all(COUNT)?.[0]?.counts?.[resourceType];

  if (!count) {
    return null;
  }

  if (!namespaces) {
    return count.summary?.count || 0;
  }

  return namespaces.reduce((sum, namespace) => sum + (count.namespaces?.[namespace]?.count || 0), 0);
}

/**
 * Count of the Namespaces list. With `hideSystemResources` it hides system and
 * Fleet managed namespaces (`list/namespace.vue` of the shell), which the
 * counts endpoint cannot tell apart. The namespaces are always loaded with the
 * cluster (namespace filter), so the count comes from them. `null` while they
 * are not loaded.
 */
function namespaceCount(getters: any): number | null {
  if (!getters.haveAll(NAMESPACE)) {
    return null;
  }

  return getters.all(NAMESPACE).filter((namespace: any) => !namespace.isSystem && !namespace.isFleetManaged).length;
}

function resourceCount(state: any, rootGetters: any, getters: any, typeObj: any): number | null {
  const type = typeObj?.name;

  if (!type) {
    throw new Error(`Resource type required to calc count: ${ JSON.stringify(typeObj) }`);
  }

  if (NO_COUNT.has(type)) {
    return null;
  }

  // Requested by `fetchFilteredCounts` (actions.ts), `null` until the response arrives
  if (SERVER_FILTERED_COUNTS[type]) {
    return state.filteredCounts?.[type] ?? null;
  }

  if (type === NAMESPACE && rootGetters.currentProduct?.hideSystemResources) {
    return namespaceCount(getters);
  }

  // schemaFor falls back to the resource of `configureType`, so this resolves
  // the nav item to the K8s resource type it lists
  const schema = getters.schemaFor(type);
  const resourceType = schema?.id || type;
  const namespaces = isFilteredByNamespace(type, schema) ? countedNamespaces(rootGetters) : null;

  return unfilteredCount(getters, resourceType, namespaces);
}

export default {
  namespaceFilterOptions: (state: any, getters: any, rootState: any, rootGetters: any) => ({
    addNamespace,
    divider,
    notFilterNamespaces
  }: any) => {
    const out = [{
      id:    ALL,
      kind:  NAMESPACE_FILTER_KINDS.SPECIAL,
      label: rootGetters['i18n/t']('nav.ns.all'),
    }];

    divider(out);

    const namespaces = getters.filterNamespace(notFilterNamespaces);

    if (!rootGetters['isStandaloneHarvester'] && rootGetters['currentCluster'] && rootGetters['currentCluster']?.id !== '_') {
      const cluster = rootGetters['currentCluster'];
      let projects = rootGetters['management/all'](
        MANAGEMENT.PROJECT
      );

      projects = sortBy(filterBy(projects, 'spec.clusterName', cluster.id), [
        'nameDisplay',
      ]).filter((project: any) => project.nameDisplay !== 'System');

      const projectsById: any = {};
      const namespacesByProject: any = {};
      let firstProject = true;

      namespacesByProject['null'] = []; // For namespaces not in a project
      for (const project of projects) {
        projectsById[project.metadata.name] = project;
      }

      for (const namespace of namespaces) {
        let projectId = namespace.projectId;

        if (!projectId || !projectsById[projectId]) {
          // If there's a projectId but that project doesn't exist, treat it like no project
          projectId = 'null';
        }

        let entry = namespacesByProject[projectId];

        if (!entry) {
          entry = [];
          namespacesByProject[namespace.projectId] = entry;
        }
        entry.push(namespace);
      }

      for (const project of projects) {
        const id = project.metadata.name;

        if (firstProject) {
          firstProject = false;
        } else {
          divider(out);
        }

        out.push({
          id:    `project://${ id }`,
          kind:  'project',
          label: project.nameDisplay,
        });

        const forThisProject = namespacesByProject[id] || [];

        addNamespace(out, forThisProject);
      }

      const orphans = namespacesByProject['null'];

      if (orphans.length) {
        if (!firstProject) {
          divider(out);
        }

        out.push({
          id:    ALL_ORPHANS,
          kind:  'project',
          label: rootGetters['i18n/t']('nav.ns.orphan'),
        });

        addNamespace(out, orphans);
      }
    } else {
      addNamespace(out, namespaces);
    }

    return out;
  },

  /**
   * filter system/fleet/cattle namespace
   */
  filterNamespace(state: any, getters: any, rootState: any, rootGetters: any, action: any) {
    const allNamespaces = getters.all('namespace');

    return (notFilterNamespaces: any = []) => {
      return allNamespaces.filter((namespace: any) => {
        return !namespace.isSystem || notFilterNamespaces.includes(namespace.id);
      });
    };
  },

  filterProject(state: any, getters: any, rootState: any, rootGetters: any) {
    const projectsInAllClusters = rootGetters['management/all'](
      MANAGEMENT.PROJECT
    );
    const currentCluster = rootGetters['currentCluster'];
    const clusterId = currentCluster.id;

    return projectsInAllClusters.filter((project: any) => project.spec.clusterName === clusterId && project.nameDisplay !== 'System');
  },

  // Few harvester resources name and REAL resource are different. E.g. HCI.NETWORK_ATTACHMENT page resource is NETWORK_ATTACHMENT.
  // Check in config/harvester-cluster.js for more details.
  // We need to look up the schema by resource name, and fallback to find using real resource name
  schemaFor: (state, getters, rootState, rootGetters) => (type, _fuzzy = false, _allowThrow = true) => {
    // follow the same logic as type-map/schemaFor in /dashboard/shell/plugins/dashboard-store/getters.js
    const normalizedType = getters.normalizeType(type);
    const schemas = state.types['schema'];
    const out = schemas?.map?.get(normalizedType);

    if (out) return out;

    // if not found, use the resource mapping in configureType for a second try
    const resourceType = rootGetters['type-map/optionsFor'](type)?.resource;
    if (resourceType && resourceType !== type) {
      const normalizedResource = getters.normalizeType(resourceType);
      return schemas?.map?.get(normalizedResource) || null;
    }

    return null;
  },

  // Overrides the `count` getter of the dashboard store, which looks up the
  // count by the nav item name only. See "Side navigation counts" above.
  count: (state: any, getters: any, rootState: any, rootGetters: any) => (typeObj: any) => {
    // Like the `count` getter of the dashboard store: a nav item configured with `subTypes`
    // shows the sum of the counts of these types, e.g. the Migration Overview
    // (`forklift-create`) shows the number of Migration Plans.
    const subTypes = rootGetters['type-map/optionsFor']?.(typeObj?.name)?.subTypes || [];

    if (subTypes.length) {
      return subTypes.reduce((acc: number, type: string) => acc + resourceCount(state, rootGetters, getters, { name: type }), 0);
    }

    return resourceCount(state, rootGetters, getters, typeObj);
  },
};
