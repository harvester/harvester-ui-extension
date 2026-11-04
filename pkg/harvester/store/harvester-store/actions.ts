//@ts-nocheck
import { ClusterNotFoundError } from '@shell/utils/error';
import { SETTING } from '@shell/config/settings';
import { COUNT, NAMESPACE, MANAGEMENT } from '@shell/config/types';
import { allHash } from '@shell/utils/promise';
import { DEV, NAMESPACE_FILTERS } from '@shell/store/prefs';
import { createNamespaceFilterKeyWithId } from '@shell/utils/namespace-filter';
import debounce from 'lodash/debounce';
import { HCI } from '../../types';
import {
  SERVER_FILTERED_COUNTS, countedNamespaces, filteredCountRequest, isFilteredByNamespace
} from './nav-counts';

export default {
  async loadCluster({
    state, commit, dispatch, getters, rootGetters, rootState
  }: any, { id }: any) {
    // This is a workaround for a timing issue where the mgmt cluster schema may not be available
    // Try and wait until the schema exists before proceeding
    await dispatch('management/waitForSchema', { type: MANAGEMENT.CLUSTER }, { root: true });

    // See if it really exists
    const cluster = await dispatch('management/find', {
      type: MANAGEMENT.CLUSTER,
      id,
      opt:  { url: `${ MANAGEMENT.CLUSTER }s/${ escape(id) }` }
    }, { root: true });

    let virtualBase = `/k8s/clusters/${ escape(id) }/v1/harvester`;

    if (id === 'local') {
      virtualBase = `/v1/harvester`;
    }

    if ( !cluster ) {
      commit('clusterId', null, { root: true });
      commit('applyConfig', { baseUrl: null });
      throw new ClusterNotFoundError(id);
    }

    // Update the Steve client URLs
    commit('applyConfig', { baseUrl: virtualBase });

    await Promise.all([
      dispatch('loadSchemas', true),
    ]);

    dispatch('subscribe');

    const projectArgs = {
      type: MANAGEMENT.PROJECT,
      opt:  {
        url:            `${ MANAGEMENT.PROJECT }/${ escape(id) }`,
        watchNamespace: id
      }
    };

    const fetchProjects = async() => {
      let limit = 30000;
      const sleep = 100;

      while ( limit > 0 && !rootState.managementReady ) {
        await setTimeout(() => {}, sleep);
        limit -= sleep;
      }

      if ( rootGetters['management/schemaFor'](MANAGEMENT.PROJECT) ) {
        return dispatch('management/findAll', projectArgs, { root: true });
      }
    };

    if (id !== 'local' && getters['schemaFor'](MANAGEMENT.SETTING)) { // multi-cluster
      const settings = await dispatch('findAll', {
        type: MANAGEMENT.SETTING,
        id:   SETTING.SYSTEM_NAMESPACES,
        opt:  { url: `${ virtualBase }/${ MANAGEMENT.SETTING }s/`, force: true }
      });

      const systemNamespaces = settings?.find((x: any) => x.id === SETTING.SYSTEM_NAMESPACES);

      if (systemNamespaces) {
        const namespace = (systemNamespaces.value || systemNamespaces.default)?.split(',');

        commit('setSystemNamespaces', namespace, { root: true });
      }
    }

    const hash: { [key: string]: Promise<any>} = {
      projects:          fetchProjects(),
      virtualCount:      dispatch('findAll', { type: COUNT }),
      virtualNamespaces: dispatch('findAll', { type: NAMESPACE }),
      settings:          dispatch('findAll', { type: HCI.SETTING }),
      clusters:          dispatch('management/findAll', {
        type: MANAGEMENT.CLUSTER,
        opt:  { force: true }
      }, { root: true }),
    };

    if (getters['schemaFor'](HCI.RESOURCE_QUOTA)) {
      hash.resourceQuota = dispatch('findAll', { type: HCI.RESOURCE_QUOTA });
    }

    if (getters['schemaFor'](HCI.UPGRADE)) {
      hash.upgrades = dispatch('findAll', { type: HCI.UPGRADE });
    }
    // Pre-fetch all HCI.UPGRADE_LOG data within loadCluster to ensure HarvesterUpgradeHeader has the necessary data. This is required because the header is dynamically loaded before the user enters the cluster in Rancher integration mode.
    // See more details in https://github.com/harvester/harvester-ui-extension/pull/715
    if (getters['schemaFor'](HCI.UPGRADE_LOG)) {
      hash.upgradeLogs = dispatch('findAll', { type: HCI.UPGRADE_LOG });
    }

    const res: any = await allHash(hash);

    const isHarvesterVersionSupported = rootGetters['harvester-common/getFeatureEnabled']('supportHarvesterClusterVersion');

    if (!isHarvesterVersionSupported) {
      const product = rootGetters['productId'];

      this.$router?.push({
        name:   `${ product }-c-cluster-unsupported${ id === 'local' ? '-standalone' : '' }`,
        params: { product }
      });

      return;
    }

    await dispatch('cleanNamespaces', null, { root: true });

    const namespaceFilterKey = createNamespaceFilterKeyWithId(id, 'harvester');
    const savedFilters = rootGetters['prefs/get'](NAMESPACE_FILTERS)?.[namespaceFilterKey];

    commit('updateNamespaces', {
      filters: savedFilters || [],
      all:     getters.filterNamespace(),
      getters
    }, { root: true });

    dispatch('watchFilteredCounts', { clusterId: id });

    // Solve compatibility with Rancher v2.6.x, fell remove these codes after not support v2.6.x
    const definition = {
      def:              false,
      parseJSON:        true,
      inheritFrom:      DEV,
      asUserPreference: true,
    };

    commit('prefs/setDefinition', {
      name: 'view-in-api',
      definition,
    }, { root: true });
    commit('prefs/setDefinition', {
      name: 'all-namespaces',
      definition,
    }, { root: true });
    commit('prefs/setDefinition', {
      name: 'theme-shortcut',
      definition,
    }, { root: true });
    commit('prefs/setDefinition', {
      name: 'plugin-developer',
      definition,
    }, { root: true });

    const isMultiCluster = !(res.clusters.length === 1 && res.clusters[0].metadata?.name === 'local');

    if (isMultiCluster) {
      commit('managementChanged', {
        ready:          true,
        isMultiCluster: true,
        isRancher:      true,
      }, { root: true });
    }
  },

  /**
   * Requests the side navigation counts of the nav items in SERVER_FILTERED_COUNTS
   * (all of them by default), see nav-counts.ts. Responses of an outdated request
   * of a nav item (e.g. before a namespace filter change) are ignored.
   */
  async fetchFilteredCounts({
    state, commit, dispatch, getters, rootGetters
  }: any, names: string[] = Object.keys(SERVER_FILTERED_COUNTS)) {
    await Promise.all(names.map(async(name: string) => {
      commit('filteredCountRequested', name);

      const requestId = state.filteredCountRequests[name];
      const request = filteredCountRequest(getters, rootGetters, name);
      let count = request?.count ?? null;

      if (request?.url) {
        try {
          const res = await dispatch('request', { url: request.url });

          // Steve leaves out `count` when nothing matches
          count = res?.count ?? 0;
        } catch (e) {
          count = null;
        }
      }

      if (state.filteredCountRequests[name] === requestId) {
        commit('setFilteredCount', { name, count });
      }
    }));
  },

  /**
   * Requests the counts of SERVER_FILTERED_COUNTS, and requests them again when
   * they may have changed: when the counts endpoint reports other numbers for
   * their resource type (it is kept up to date through the websocket), and when
   * the namespace filter changes. A change that leaves these numbers as they are
   * (e.g. adding the cloud-init template label to an existing ConfigMap) shows up
   * with the next change of that resource type.
   */
  watchFilteredCounts({
    state, commit, dispatch, getters, rootGetters
  }: any, { clusterId }: any) {
    state.filteredCountWatchers.forEach((unwatch: () => void) => unwatch());
    commit('resetFilteredCounts');

    // The watchers stay registered after leaving the cluster, until the next `loadCluster`
    const refresh = (names: string[]) => {
      if (rootGetters.clusterId === clusterId) {
        dispatch('fetchFilteredCounts', names);
      }
    };
    const names = Object.keys(SERVER_FILTERED_COUNTS);
    const namesByType: Record<string, string[]> = {};

    names.forEach((name) => {
      const type = getters.schemaFor(name)?.id;

      if (type) {
        namesByType[type] = [...(namesByType[type] || []), name];
      }
    });

    const unwatchers = Object.entries(namesByType).map(([type, namesOfType]) => this.watch(
      () => JSON.stringify(getters.all(COUNT)?.[0]?.counts?.[type] || null),
      debounce(() => refresh(namesOfType), 1000)
    ));

    unwatchers.push(this.watch(
      () => JSON.stringify(countedNamespaces(rootGetters)),
      () => refresh(names.filter((name) => isFilteredByNamespace(name, getters.schemaFor(name))))
    ));

    commit('setFilteredCountWatchers', unwatchers);

    return dispatch('fetchFilteredCounts');
  },
};
