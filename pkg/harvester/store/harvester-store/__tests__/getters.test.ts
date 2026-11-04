import {
  CONFIG_MAP, COUNT, NAMESPACE, NETWORK_ATTACHMENT, NODE, PVC, STORAGE_CLASS
} from '@shell/config/types';
import harvesterGetters from '../getters';
import { HCI, VOLUME_SNAPSHOT } from '../../../types';

// Nav item -> resource type, like `configureType(..., { resource })` in config/harvester-cluster.js
const RESOURCE_MAP: Record<string, string> = {
  [HCI.HOST]:               NODE,
  [HCI.VOLUME]:             PVC,
  [HCI.NETWORK_ATTACHMENT]: NETWORK_ATTACHMENT,
  [HCI.VM_SNAPSHOT]:        HCI.BACKUP,
  [HCI.SNAPSHOT]:           VOLUME_SNAPSHOT,
  [HCI.CLOUD_TEMPLATE]:     CONFIG_MAP,
  [HCI.STORAGE]:            STORAGE_CLASS,
};

const CLUSTER_SCOPED = [NODE, STORAGE_CLASS, NAMESPACE];

const counts = (byNamespace: Record<string, number>) => ({
  summary:    { count: Object.values(byNamespace).reduce((sum, count) => sum + count, 0) },
  namespaces: Object.fromEntries(Object.entries(byNamespace).map(([ns, count]) => [ns, { count }])),
});

/**
 * Creates the `count` getter with a minimal store. `counts` is the result of
 * Steve's counts endpoint, `filteredCounts` the counts requested by
 * `fetchFilteredCounts` and `lists` the loaded store lists.
 */
function createCount({
  counts = {}, filteredCounts = {}, lists = {}, isAllNamespaces = true, hideSystemResources = false, namespaces = {}
}: any = {}) {
  const schemas = new Map<string, any>();

  // Schemas of the resource types used below. `count` only filters by namespace if the
  // schema marks the type as namespaced, so a namespaced type without a schema here would be
  // counted in all namespaces. RESOURCE_MAP contains the resource types of nav items with a
  // different name, the others are nav items named like the resource type they list.
  [...Object.values(RESOURCE_MAP), HCI.BACKUP, HCI.SCHEDULE_VM_BACKUP, HCI.VM, HCI.FLOW, NAMESPACE].forEach((id) => {
    schemas.set(id, { id, attributes: { namespaced: !CLUSTER_SCOPED.includes(id) } });
  });

  const state = { types: { schema: { map: schemas } }, filteredCounts };
  const rootGetters = {
    isAllNamespaces,
    namespaces:            () => namespaces,
    // Empty on purpose: this cache is not necessarily filled yet when the side navigation is
    // rendered, e.g. right after loading the dashboard. `count` must use `namespaces()`;
    // reading this cache would make the tests that select namespaces fail.
    activeNamespaceCache:  {},
    currentProduct:        { hideSystemResources },
    'type-map/optionsFor': (type: string) => (RESOURCE_MAP[type] ? { resource: RESOURCE_MAP[type] } : {}),
  };
  const getters: any = {
    normalizeType: (type: string) => type,
    haveAll:       jest.fn((type: string) => !!lists[type]),
    all:           jest.fn((type: string) => (type === COUNT ? [{ counts }] : lists[type] || [])),
  };

  getters.schemaFor = harvesterGetters.schemaFor(state, getters, {}, rootGetters);

  const count = harvesterGetters.count(state, getters, {}, rootGetters);

  return (name: string) => count({ name });
}

describe('harvester store: count', () => {
  describe('nav items listing all resources of a type', () => {
    it('should look up the count of the underlying resource type', () => {
      const count = createCount({ counts: { [NODE]: counts({ '': 3 }) } });

      expect(count(HCI.HOST)).toBe(3);
    });

    it('should only count the selected namespaces', () => {
      const count = createCount({
        counts:               { [HCI.VM]: counts({ default: 4, test: 2 }) },
        isAllNamespaces:      false,
        namespaces: { test: true },
      });

      expect(count(HCI.VM)).toBe(2);
    });

    it('should not count system namespaces with "All Namespaces" when system resources are hidden', () => {
      const count = createCount({
        counts:               { [HCI.VM]: counts({ default: 4, 'cattle-monitoring-system': 2 }) },
        hideSystemResources:  true,
        namespaces: { default: true },
      });

      expect(count(HCI.VM)).toBe(4);
    });

    it('should count nothing for an empty namespace selection, e.g. a project without namespaces', () => {
      const count = createCount({
        counts:               { [HCI.VM]: counts({ default: 4, test: 2 }) },
        isAllNamespaces:      false,
        namespaces: {},
      });

      expect(count(HCI.VM)).toBe(0);
    });

    it('should count all namespaces for lists that ignore the namespace filter', () => {
      const count = createCount({
        counts:               { [HCI.FLOW]: counts({ a: 2, b: 1 }) },
        isAllNamespaces:      false,
        namespaces: { a: true },
      });

      expect(count(HCI.FLOW)).toBe(3);
    });

    it('should ignore the namespace filter for cluster-scoped resources', () => {
      const count = createCount({
        counts:               { [NODE]: counts({ '': 3 }) },
        isAllNamespaces:      false,
        namespaces: { test: true },
      });

      expect(count(HCI.HOST)).toBe(3);
    });

    it('should count all VM Schedules, whatever their type', () => {
      const count = createCount({ counts: { [HCI.SCHEDULE_VM_BACKUP]: counts({ default: 2 }) } });

      expect(count(HCI.SCHEDULE_VM_BACKUP)).toBe(2);
    });

    it('should return null for nav items without counts', () => {
      expect(createCount()(HCI.DASHBOARD)).toBeNull();
    });
  });

  describe('nav items listing a subset of a resource type', () => {
    it('should show the count requested from the server', () => {
      const count = createCount({
        counts:         { [HCI.BACKUP]: counts({ default: 3 }) },
        filteredCounts: { [HCI.BACKUP]: 1, [HCI.VM_SNAPSHOT]: 2 },
      });

      expect(count(HCI.BACKUP)).toBe(1);
      expect(count(HCI.VM_SNAPSHOT)).toBe(2);
    });

    it.each([
      HCI.BACKUP, HCI.VM_SNAPSHOT, HCI.SNAPSHOT, HCI.STORAGE, HCI.CLOUD_TEMPLATE, HCI.NETWORK_ATTACHMENT
    ])('should not use the total of the counts endpoint for %s before the server count arrives', (name) => {
      const count = createCount({ counts: Object.fromEntries(Object.values(RESOURCE_MAP).concat(HCI.BACKUP).map((type) => [type, counts({ default: 3 })])) });

      expect(count(name)).toBeNull();
    });

    it('should show 0 when the server count is 0', () => {
      expect(createCount({ filteredCounts: { [HCI.STORAGE]: 0 } })(HCI.STORAGE)).toBe(0);
    });
  });

  describe('volumes', () => {
    it('should not show a count, as the total of the counts endpoint includes hidden volumes', () => {
      const count = createCount({ counts: { [PVC]: counts({ default: 4 }) } });

      expect(count(HCI.VOLUME)).toBeNull();
    });
  });

  describe('namespaces', () => {
    const namespace = (isSystem = false, isFleetManaged = false) => ({ isSystem, isFleetManaged });

    it('should not count system and Fleet managed namespaces when system resources are hidden', () => {
      const count = createCount({
        counts:              { [NAMESPACE]: counts({ '': 4 }) },
        lists:               { [NAMESPACE]: [namespace(), namespace(), namespace(true), namespace(false, true)] },
        hideSystemResources: true,
      });

      expect(count(NAMESPACE)).toBe(2);
    });

    it('should return null until the namespaces are loaded when system resources are hidden', () => {
      const count = createCount({ counts: { [NAMESPACE]: counts({ '': 4 }) }, hideSystemResources: true });

      expect(count(NAMESPACE)).toBeNull();
    });

    it('should count all namespaces when system resources are shown', () => {
      const count = createCount({ counts: { [NAMESPACE]: counts({ '': 4 }) } });

      expect(count(NAMESPACE)).toBe(4);
    });
  });
});
