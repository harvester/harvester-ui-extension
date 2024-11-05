//@ts-nocheck
import {
  NAMESPACE_FILTER_KINDS,
  NAMESPACE_FILTER_ALL as ALL,
  NAMESPACE_FILTER_ALL_ORPHANS as ALL_ORPHANS,
} from '@shell/utils/namespace-filter';
import { MANAGEMENT } from '@shell/config/types';
import { sortBy } from '@shell/utils/sort';
import { filterBy } from '@shell/utils/array';
import Resource from '@shell/plugins/dashboard-store/resource-class';
import { lookup } from '@shell/plugins/dashboard-store/model-loader';
import { serverVersion } from '@pkg/harvester/utils/server';

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

  classify: (state, getters, rootState, rootGetters) => (obj) => {
    const version = serverVersion(rootGetters);

    const modelVersion = version ? `${ obj?.type }-${ version }` : obj?.type;

    const model = lookup(state.config.namespace, modelVersion, obj?.metadata?.name, rootState);

    if (model) {
      return model;
    }
  
    return lookup(state.config.namespace, obj?.type, obj?.metadata?.name, rootState) || Resource;
  },

  getCustomList(state, getters, rootState, rootGetters) {
    return (resource) => {

      const version = serverVersion(rootGetters);

      if (version) {
        const componentVersion = `${ resource }-${ version }`;

        const hasVersionComponent = rootGetters['type-map/hasCustomList'](componentVersion);

        if (hasVersionComponent) {
          return componentVersion;
        }
      }

      if (rootGetters['type-map/hasCustomList'](resource)) {
        return resource;
      }

      return null;
    }
  },

  hasCustomDetail(state, getters, rootState, rootGetters) {
    return (resource, id) => {

      const version = serverVersion(rootGetters);

      if (version) {
        const componentVersion = `${ resource }-${ version }`;

        const hasVersionComponent = rootGetters['type-map/hasCustomDetail'](componentVersion, id);

        if (hasVersionComponent) {
          return componentVersion;
        }
      }

      if (rootGetters['type-map/hasCustomDetail'](resource, id)) {
        return resource;
      }

      return null;
    }
  },

  hasCustomEdit(state, getters, rootState, rootGetters) {
    return (resource, id) => {

      const version = serverVersion(rootGetters);

      if (version) {
        const componentVersion = `${ resource }-${ version }`;

        const hasVersionComponent = rootGetters['type-map/hasCustomEdit'](componentVersion, id);

        if (hasVersionComponent) {
          return componentVersion;
        }
      }

      if (rootGetters['type-map/hasCustomEdit'](resource, id)) {
        return resource;
      }

      return null;
    }
  },

  importDetail(state, getters, rootState, rootGetters) {
    return (resource, id) => {

      const version = serverVersion(rootGetters);

      if (version) {
        const componentVersion = `${ resource }-${ version }`;

        if (rootGetters['type-map/hasCustomDetail'](componentVersion, id)) {
          return rootGetters['type-map/importDetail'](componentVersion, id);
        }
      }

      return rootGetters['type-map/importDetail'](resource, id);
    }
  },

  importEdit(state, getters, rootState, rootGetters) {
    return (resource, id) => {

      const version = serverVersion(rootGetters);

      if (version) {
        const componentVersion = `${ resource }-${ version }`;

        if (rootGetters['type-map/hasCustomEdit'](componentVersion, id)) {
          return rootGetters['type-map/importEdit'](componentVersion, id);
        }
      }

      return rootGetters['type-map/importEdit'](resource, id);
    }
  },
};
