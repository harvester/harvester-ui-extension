//@ts-nocheck
import {
  NAMESPACE_FILTER_KINDS,
  NAMESPACE_FILTER_ALL as ALL,
  NAMESPACE_FILTER_ALL_ORPHANS as ALL_ORPHANS,
} from '@shell/utils/namespace-filter';
import { COUNT, MANAGEMENT, NAMESPACE } from '@shell/config/types';
import { sortBy } from '@shell/utils/sort';
import { filterBy } from '@shell/utils/array';
import {
  NO_COUNT, SERVER_FILTERED_COUNTS, countedNamespaces, isFilteredByNamespace
} from './nav-counts';

// See "Side navigation counts" in nav-counts.ts.

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
  // count by the nav item name only. See "Side navigation counts" in nav-counts.ts.
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
