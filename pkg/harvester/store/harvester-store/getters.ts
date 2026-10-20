//@ts-nocheck
import {
  NAMESPACE_FILTER_KINDS,
  NAMESPACE_FILTER_ALL as ALL,
  NAMESPACE_FILTER_ALL_ORPHANS as ALL_ORPHANS,
} from '@shell/utils/namespace-filter';
import { COUNT, MANAGEMENT } from '@shell/config/types';
import { sortBy } from '@shell/utils/sort';
import { filterBy } from '@shell/utils/array';
import { HCI } from '../../types';
import { BACKUP_TYPE } from '../../config/types';
import { HCI as HCI_ANNOTATIONS } from '../../config/labels-annotations';
import { sharedComputed } from '../../utils/shared-computed';

// ---------------------------------------------------------------------------
// Side navigation counts
//
// The side navigation (`Type.vue`, `type-map/getTree`) shows the number of
// resources of a nav item by calling `harvester/count({ name: <nav item> })`.
// Many Harvester nav items are named differently than the K8s resource they
// list (e.g. `harvesterhci.io.volume` lists `persistentvolumeclaim`, see
// `configureType(..., { resource })` in config/harvester-cluster.js). Some
// list views additionally show only a subset of that resource type. The
// `count` getter below handles both cases, so the count matches the list.
// ---------------------------------------------------------------------------

/**
 * Nav items whose list view shows only a subset of the underlying resource
 * type. Each predicate must match the filter of the list view, so keep them in
 * sync with the files in list/. The items are store models, so model getters
 * can be used.
 *
 * Steve's counts endpoint only knows the total per resource type, so these
 * counts are computed from the store list. They are only available once that
 * list is loaded (see `filteredCount`).
 */
const FILTERED_COUNT_PREDICATES: Record<string, (r: any) => boolean> = {
  // list/harvesterhci.io.volume.vue: hides golden image and CDI populator volumes.
  // ResourceTable also hides system resources (`isSystemResource`), which can be listed
  // when a system namespace is explicitly selected in the namespace filter
  [HCI.VOLUME]:             (r) => !r.isGoldenImageVolume && !r.isCDIPopulatorVolume && !r.isSystemResource,
  // list/harvesterhci.io.networkattachmentdefinition.vue: hides the storage network
  [HCI.NETWORK_ATTACHMENT]: (r) => !r.metadata?.annotations?.[HCI_ANNOTATIONS.STORAGE_NETWORK],
  // VM backups and VM snapshots are both VirtualMachineBackup resources
  [HCI.BACKUP]:             (r) => r.spec?.type !== BACKUP_TYPE.SNAPSHOT,
  [HCI.VM_SNAPSHOT]:        (r) => r.spec?.type === BACKUP_TYPE.SNAPSHOT,
  // list/harvesterhci.io.schedulevmbackup.vue: hides snapshot-type schedules
  [HCI.SCHEDULE_VM_BACKUP]: (r) => r.spec?.type !== BACKUP_TYPE.SNAPSHOT,
  // VM snapshots also create VolumeSnapshots, owned by the VirtualMachineBackup
  [HCI.SNAPSHOT]:           (r) => r.metadata?.ownerReferences?.[0]?.kind === 'PersistentVolumeClaim',
  // Only ConfigMaps labeled as cloud-init template
  [HCI.CLOUD_TEMPLATE]:     (r) => !!r.metadata?.labels?.[HCI_ANNOTATIONS.CLOUD_INIT],
  // Every VM image creates an internal backing image StorageClass
  [HCI.STORAGE]:            (r) => !r.parameters?.backingImage,
};

/**
 * Nav items whose list view lists the resources of all namespaces whatever the
 * namespace filter is (`:ignore-filter="true"` or `:namespaced="false"` on
 * `ResourceTable`). Keep in sync with the files in list/.
 */
const IGNORE_NAMESPACE_FILTER = new Set<string>([
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
function countedNamespaces(rootGetters: any): string[] | null {
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
 * Count of the resources of `resourceType` that match `predicate`.
 *
 * The matches are counted per namespace once per store list (`sharedComputed`,
 * keyed by the predicate) instead of on every render of the nav item. The
 * computed is evaluated again when the store list changes.
 *
 * As long as the list is not loaded, the count is only known if there are no
 * resources of that type at all (`0`), otherwise `null` (no count shown).
 * `loadCluster` (actions.ts) requests most of these lists without awaiting them,
 * so their count is shown shortly after the cluster is loaded. ConfigMaps (Cloud
 * Configuration Templates) are not requested there, they are only loaded by the
 * pages using them (e.g. their list view). Getters must not have side effects, so
 * the list is not loaded here.
 */
function filteredCount(getters: any, resourceType: string, predicate: (r: any) => boolean, namespaces: string[] | null): number | null {
  if (!getters.haveAll?.(resourceType)) {
    return unfilteredCount(getters, resourceType, null) === 0 ? 0 : null;
  }

  const { total, byNamespace } = sharedComputed(getters.all(resourceType), predicate, (list: any[]) => {
    const byNamespace = new Map<string, number>();
    let total = 0;

    for (const item of list) {
      if (predicate(item)) {
        const namespace = item.metadata?.namespace;

        byNamespace.set(namespace, (byNamespace.get(namespace) || 0) + 1);
        total++;
      }
    }

    return { total, byNamespace };
  });

  if (!namespaces) {
    return total;
  }

  return namespaces.reduce((sum, namespace) => sum + (byNamespace.get(namespace) || 0), 0);
}

function resourceCount(rootGetters: any, getters: any, typeObj: any): number | null {
  const type = typeObj?.name;

  if (!type) {
    throw new Error(`Resource type required to calc count: ${ JSON.stringify(typeObj) }`);
  }

  // schemaFor falls back to the resource of `configureType`, so this resolves
  // the nav item to the K8s resource type it lists
  const schema = getters.schemaFor(type);
  const resourceType = schema?.id || type;
  const namespaces = schema?.attributes?.namespaced && !IGNORE_NAMESPACE_FILTER.has(type) ? countedNamespaces(rootGetters) : null;
  const predicate = FILTERED_COUNT_PREDICATES[type];

  return predicate ? filteredCount(getters, resourceType, predicate, namespaces) : unfilteredCount(getters, resourceType, namespaces);
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
      return subTypes.reduce((acc: number, type: string) => acc + resourceCount(rootGetters, getters, { name: type }), 0);
    }

    return resourceCount(rootGetters, getters, typeObj);
  },
};
