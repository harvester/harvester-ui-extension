import {
  CONFIG_MAP, COUNT, NAMESPACE, NETWORK_ATTACHMENT, NODE, PVC, STORAGE_CLASS
} from '@shell/config/types';
import harvesterGetters from '../getters';
import { HCI, VOLUME_SNAPSHOT } from '../../../types';
import { HCI_SETTING } from '../../../config/settings';

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
  counts = {}, filteredCounts = {}, lists = {}, visibleSettings = [], isAllNamespaces = true, hideSystemResources = false, namespaces = {}
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
    visibleSettings,
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

  describe('settings', () => {
    it('should count the settings shown by the page, not all the settings', () => {
      const count = createCount({
        counts:          { [HCI.SETTING]: counts({ '': 5 }) },
        lists:           { [HCI.SETTING]: [{}] },
        visibleSettings: [{}, {}],
      });

      expect(count(HCI.SETTING)).toBe(2);
    });

    it('should return null until the settings are loaded', () => {
      expect(createCount({ visibleSettings: [{}] })(HCI.SETTING)).toBeNull();
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

describe('harvester store: visibleSettings', () => {
  const { BACKUP_TARGET, MAX_HOTPLUG_RATIO, UI_PL } = HCI_SETTING;
  const setting = (id: string, source = 'harvester') => ({ id, source });

  function visibleSettings({
    harvester = [] as string[], management = [] as string[], isSingleProduct = false, isStandaloneHarvester = false, enabledFeatures = [] as string[]
  } = {}) {
    const rootGetters = {
      isSingleProduct,
      isStandaloneHarvester,
      'management/all':                     () => management.map((id) => setting(id, 'management')),
      'harvester-common/getFeatureEnabled': (feature: string) => enabledFeatures.includes(feature),
    };

    return harvesterGetters.visibleSettings({}, { all: () => harvester.map((id) => setting(id)) }, {}, rootGetters);
  }

  const ids = (args: any) => visibleSettings(args).map(({ id }: any) => id);

  it('should only show the allowed settings', () => {
    expect(ids({ harvester: [BACKUP_TARGET, 'api-ui-version'] })).toStrictEqual([BACKUP_TARGET]);
  });

  it('should return the config and the resource of a setting', () => {
    const [shown] = visibleSettings({ harvester: [BACKUP_TARGET] });

    expect(shown.data).toStrictEqual(setting(BACKUP_TARGET));
    expect(shown.config.kind).toBe('json');
  });

  it('should not show allowed settings that do not exist in the cluster', () => {
    expect(ids({ harvester: [] })).toStrictEqual([]);
  });

  it('should only show settings with a feature flag when the version supports it', () => {
    expect(ids({ harvester: [MAX_HOTPLUG_RATIO] })).toStrictEqual([]);
    expect(ids({ harvester: [MAX_HOTPLUG_RATIO], enabledFeatures: ['cpuMemoryHotplug'] })).toStrictEqual([MAX_HOTPLUG_RATIO]);
  });

  it('should only show the single cluster settings on a standalone Harvester', () => {
    expect(ids({ harvester: [UI_PL] })).toStrictEqual([]);
    expect(ids({ harvester: [UI_PL], isStandaloneHarvester: true })).toStrictEqual([UI_PL]);
  });

  it('should only use the settings of the management store in a single product', () => {
    expect(ids({ management: [BACKUP_TARGET] })).toStrictEqual([]);
    expect(ids({ management: [BACKUP_TARGET], isSingleProduct: true })).toStrictEqual([BACKUP_TARGET]);
  });

  it('should prefer the Harvester setting over the management setting with the same id', () => {
    const [shown] = visibleSettings({
      harvester: [BACKUP_TARGET], management: [BACKUP_TARGET], isSingleProduct: true
    });

    expect(shown.data.source).toBe('harvester');
  });
});
