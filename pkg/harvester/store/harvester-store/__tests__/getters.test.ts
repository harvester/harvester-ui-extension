import { reactive } from 'vue';
import {
  CONFIG_MAP, COUNT, NETWORK_ATTACHMENT, NODE, PVC, STORAGE_CLASS
} from '@shell/config/types';
import harvesterGetters from '../getters';
import { HCI, VOLUME_SNAPSHOT } from '../../../types';
import { HCI as HCI_ANNOTATIONS } from '../../../config/labels-annotations';

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

const CLUSTER_SCOPED = [NODE, STORAGE_CLASS];

const backup = (namespace: string, type: string) => ({ metadata: { namespace }, spec: { type } });
const pvc = (namespace: string, flags = {}) => ({ metadata: { namespace }, ...flags });
const counts = (byNamespace: Record<string, number>) => ({
  summary:    { count: Object.values(byNamespace).reduce((sum, count) => sum + count, 0) },
  namespaces: Object.fromEntries(Object.entries(byNamespace).map(([ns, count]) => [ns, { count }])),
});

/**
 * Creates the `count` getter with a minimal store. `lists` are the loaded store
 * lists, `counts` the result of Steve's counts endpoint.
 */
function createCount({
  counts = {}, lists = {}, isAllNamespaces = true, hideSystemResources = false, activeNamespaceCache = {}
}: any = {}) {
  const schemas = new Map<string, any>();

  [...Object.values(RESOURCE_MAP), HCI.BACKUP, HCI.VM, HCI.FLOW].forEach((id) => {
    schemas.set(id, { id, attributes: { namespaced: !CLUSTER_SCOPED.includes(id) } });
  });

  const state = { types: { schema: { map: schemas } } };
  const rootGetters = {
    isAllNamespaces,
    activeNamespaceCache,
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
        activeNamespaceCache: { test: true },
      });

      expect(count(HCI.VM)).toBe(2);
    });

    it('should not count system namespaces with "All Namespaces" when system resources are hidden', () => {
      const count = createCount({
        counts:               { [HCI.VM]: counts({ default: 4, 'cattle-monitoring-system': 2 }) },
        hideSystemResources:  true,
        activeNamespaceCache: { default: true },
      });

      expect(count(HCI.VM)).toBe(4);
    });

    it('should count nothing for an empty namespace selection, e.g. a project without namespaces', () => {
      const count = createCount({
        counts:               { [HCI.VM]: counts({ default: 4, test: 2 }) },
        isAllNamespaces:      false,
        activeNamespaceCache: {},
      });

      expect(count(HCI.VM)).toBe(0);
    });

    it('should count all namespaces for lists that ignore the namespace filter', () => {
      const count = createCount({
        counts:               { [HCI.FLOW]: counts({ a: 2, b: 1 }) },
        isAllNamespaces:      false,
        activeNamespaceCache: { a: true },
      });

      expect(count(HCI.FLOW)).toBe(3);
    });

    it('should ignore the namespace filter for cluster-scoped resources', () => {
      const count = createCount({
        counts:               { [NODE]: counts({ '': 3 }) },
        isAllNamespaces:      false,
        activeNamespaceCache: { test: true },
      });

      expect(count(HCI.HOST)).toBe(3);
    });

    it('should return null for nav items without counts', () => {
      expect(createCount()(HCI.DASHBOARD)).toBeNull();
    });
  });

  describe('nav items listing a subset of a resource type', () => {
    it('should return null until the list is loaded', () => {
      const count = createCount({ counts: { [HCI.BACKUP]: counts({ default: 2 }) } });

      expect(count(HCI.VM_SNAPSHOT)).toBeNull();
      expect(count(HCI.BACKUP)).toBeNull();
    });

    it('should return 0 before the list is loaded if there are no resources of that type', () => {
      const count = createCount({ counts: { [HCI.BACKUP]: counts({}) } });

      expect(count(HCI.VM_SNAPSHOT)).toBe(0);
    });

    it('should not count golden image, CDI populator and system resource volumes', () => {
      const count = createCount({
        counts: { [PVC]: counts({ default: 4 }) },
        lists:  {
          [PVC]: reactive([
            pvc('default'),
            pvc('default', { isGoldenImageVolume: true }),
            pvc('default', { isCDIPopulatorVolume: true }),
            pvc('default', { isSystemResource: true }),
          ])
        },
      });

      expect(count(HCI.VOLUME)).toBe(1);
    });

    it('should not count the storage network and ignore the namespace filter', () => {
      const count = createCount({
        lists: {
          [NETWORK_ATTACHMENT]: reactive([
            { metadata: { namespace: 'a' } },
            { metadata: { namespace: 'b' } },
            { metadata: { namespace: 'b', annotations: { [HCI_ANNOTATIONS.STORAGE_NETWORK]: 'true' } } },
          ])
        },
        isAllNamespaces:      false,
        activeNamespaceCache: { a: true },
      });

      expect(count(HCI.NETWORK_ATTACHMENT)).toBe(2);
    });

    it('should tell VM backups and VM snapshots apart', () => {
      const count = createCount({ lists: { [HCI.BACKUP]: reactive([backup('a', 'backup'), backup('a', 'snapshot'), backup('b', 'snapshot')]) } });

      expect(count(HCI.BACKUP)).toBe(1);
      expect(count(HCI.VM_SNAPSHOT)).toBe(2);
    });

    it('should only count volume snapshots of volumes, not those of VM snapshots', () => {
      const count = createCount({
        lists: {
          [VOLUME_SNAPSHOT]: reactive([
            { metadata: { namespace: 'a', ownerReferences: [{ kind: 'PersistentVolumeClaim' }] } },
            { metadata: { namespace: 'a', ownerReferences: [{ kind: 'VirtualMachineBackup' }] } },
          ])
        },
      });

      expect(count(HCI.SNAPSHOT)).toBe(1);
    });

    it('should only count cloud-init template ConfigMaps', () => {
      const count = createCount({
        lists: {
          [CONFIG_MAP]: reactive([
            { metadata: { namespace: 'default', labels: { [HCI_ANNOTATIONS.CLOUD_INIT]: 'user' } } },
            { metadata: { namespace: 'default', name: 'kube-root-ca.crt' } },
          ])
        },
      });

      expect(count(HCI.CLOUD_TEMPLATE)).toBe(1);
    });

    it('should not count backing image StorageClasses and ignore the namespace filter', () => {
      const count = createCount({
        lists: {
          [STORAGE_CLASS]: reactive([
            { metadata: { name: 'harvester-longhorn' }, parameters: {} },
            { metadata: { name: 'longhorn-image-abc' }, parameters: { backingImage: 'vmi-abc' } },
          ])
        },
        isAllNamespaces:      false,
        activeNamespaceCache: { default: true },
      });

      expect(count(HCI.STORAGE)).toBe(1);
    });

    it('should count nothing for an empty namespace selection, e.g. a project without namespaces', () => {
      const count = createCount({
        counts:               { [PVC]: counts({ default: 2 }) },
        lists:                { [PVC]: reactive([pvc('default'), pvc('default')]) },
        isAllNamespaces:      false,
        activeNamespaceCache: {},
      });

      expect(count(HCI.VOLUME)).toBe(0);
    });

    it('should only count the selected namespaces and update when the list changes in place', () => {
      const list = reactive([backup('a', 'snapshot'), backup('b', 'snapshot'), backup('c', 'snapshot')]);
      const count = createCount({
        lists:                { [HCI.BACKUP]: list },
        isAllNamespaces:      false,
        activeNamespaceCache: { a: true, c: true },
      });

      expect(count(HCI.VM_SNAPSHOT)).toBe(2);

      list.push(backup('a', 'snapshot'));

      expect(count(HCI.VM_SNAPSHOT)).toBe(3);
    });
  });
});
