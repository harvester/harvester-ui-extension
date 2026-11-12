import {
  CONFIG_MAP, COUNT, NETWORK_ATTACHMENT, PVC, STORAGE_CLASS
} from '@shell/config/types';
import harvesterStore from '../index';
import harvesterActions from '../actions';
import harvesterMutations from '../mutations';
import { SERVER_FILTERED_COUNTS, filteredCountRequest } from '../getters';
import { HCI, DATA_VOLUME, VOLUME_SNAPSHOT } from '../../../types';
import { PRODUCT_NAME } from '../../../config/harvester';

const BASE = 'https://harvester/v1/harvester';

// Nav item -> resource type, like `configureType(..., { resource })` in config/harvester-cluster.js
const RESOURCE_MAP: Record<string, string> = {
  [HCI.BACKUP]:             HCI.BACKUP,
  [HCI.VM_SNAPSHOT]:        HCI.BACKUP,
  [HCI.SNAPSHOT]:           VOLUME_SNAPSHOT,
  [HCI.STORAGE]:            STORAGE_CLASS,
  [HCI.CLOUD_TEMPLATE]:     CONFIG_MAP,
  [HCI.NETWORK_ATTACHMENT]: NETWORK_ATTACHMENT,
  [HCI.VOLUME]:             PVC,
  [DATA_VOLUME]:            DATA_VOLUME,
};

const CLUSTER_SCOPED = [STORAGE_CLASS];

const schemaFor = (name: string) => {
  const id = RESOURCE_MAP[name];

  return id ? {
    id, attributes: { namespaced: !CLUSTER_SCOPED.includes(id) }, links: { collection: `${ BASE }/${ id }s` }
  } : null;
};

function createGetters({ counts = {} }: any = {}) {
  return {
    schemaFor,
    urlFor: (type: string) => `${ BASE }/${ type }s`,
    all:    (type: string) => (type === COUNT ? [{ counts }] : []),
  };
}

function createRootGetters({
  isAllNamespaces = true, hideSystemResources = true, namespaces = { default: true, test: true }, clusterId = 'local'
}: any = {}) {
  return {
    isAllNamespaces,
    currentProduct: { hideSystemResources, inStore: PRODUCT_NAME },
    namespaces:     () => namespaces,
    clusterId,
  };
}

function createState() {
  return {
    filteredCounts: {}, filteredCountRequests: {}, filteredCountWatchers: []
  };
}

/**
 * A minimal store context for the actions: `commit` runs the real mutations,
 * `request` resolves with `responses[url]` (or rejects for an Error).
 */
function createContext({ responses = {}, getters = createGetters(), rootGetters = createRootGetters() }: any = {}) {
  const state: any = createState();
  const commit = jest.fn((type: string, payload: any) => (harvesterMutations as any)[type](state, payload));
  const request = jest.fn(({ url }: any) => {
    const res = Object.entries(responses).find(([part]) => url.includes(part))?.[1];

    return res instanceof Error ? Promise.reject(res) : Promise.resolve(res || {});
  });
  const dispatch = jest.fn((action: string, payload: any) => {
    if (action === 'request') {
      return request(payload);
    }

    return (harvesterActions as any)[action](context, payload);
  });
  const context: any = {
    state, commit, dispatch, getters, rootGetters
  };

  return { context, state, request };
}

describe('harvester store: side navigation counts', () => {
  it('should have the state of the counts in the store', () => {
    expect((harvesterStore.specifics as any).state()).toMatchObject({
      filteredCounts: {}, filteredCountRequests: {}, filteredCountWatchers: []
    });
  });

  it('should start the counts when the cluster is loaded', async() => {
    const dispatch = jest.fn((action: string) => Promise.resolve(action === 'management/findAll' ? [{ metadata: { name: 'local' } }] : { id: 'local' }));
    const context: any = {
      state:       {},
      commit:      jest.fn(),
      dispatch,
      getters:     { schemaFor: () => null, filterNamespace: () => [] },
      rootGetters: {
        'management/schemaFor':                () => null,
        'harvester-common/getFeatureEnabled': () => true,
        'prefs/get':                           () => ({}),
      },
      rootState: { managementReady: true },
    };

    await (harvesterActions as any).loadCluster(context, { id: 'local' });

    expect(dispatch).toHaveBeenCalledWith('watchFilteredCounts', { clusterId: 'local' });
  });

  describe('filteredCountRequest', () => {
    it('should request the filtered list with a page size of 1', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ hideSystemResources: false }), HCI.BACKUP);

      expect(req).toStrictEqual({ url: `${ BASE }/${ HCI.BACKUP }s?filter=spec.type!%3Dsnapshot&pagesize=1` });
    });

    it.each(Object.keys(SERVER_FILTERED_COUNTS))('should build a request for %s', (name) => {
      const url = filteredCountRequest(createGetters(), createRootGetters(), name)?.url || '';

      expect(url.startsWith(`${ BASE }/${ RESOURCE_MAP[name] }s?`)).toBe(true);
      expect(url).toContain('pagesize=1');
    });

    it('should only request the selected namespaces', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ isAllNamespaces: false, namespaces: { a: true, b: true } }), HCI.VM_SNAPSHOT);

      expect(req?.url).toContain('projectsornamespaces=a%2Cb');
    });

    it('should leave out system namespaces with "All Namespaces" when system resources are hidden', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ namespaces: { default: true } }), HCI.CLOUD_TEMPLATE);

      expect(req?.url).toContain('projectsornamespaces=default');
    });

    it('should not filter by namespace with "All Namespaces" when system resources are shown', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ hideSystemResources: false }), HCI.SNAPSHOT);

      expect(req?.url).not.toContain('projectsornamespaces');
    });

    it.each([HCI.STORAGE, HCI.NETWORK_ATTACHMENT])('should ignore the namespace filter for %s', (name) => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ isAllNamespaces: false, namespaces: { a: true } }), name);

      expect(req?.url).not.toContain('projectsornamespaces');
    });

    it('should not send a request for an empty namespace selection', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ isAllNamespaces: false, namespaces: {} }), HCI.BACKUP);

      expect(req).toStrictEqual({ count: 0 });
    });

    it('should request the volumes without the temporary volumes of CDI', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ hideSystemResources: false }), HCI.VOLUME);

      expect(req).toStrictEqual({ url: `${ BASE }/${ PVC }s?filter=metadata.ownerReferences.kind!%3DPersistentVolumeClaim&pagesize=1` });
    });

    it('should request the golden image volumes through the DataVolumes owned by a VM image, in the selected namespaces', () => {
      const req = filteredCountRequest(createGetters(), createRootGetters({ isAllNamespaces: false, namespaces: { a: true } }), DATA_VOLUME);

      expect(req).toStrictEqual({ url: `${ BASE }/${ DATA_VOLUME }s?filter=metadata.ownerReferences.kind%3DVirtualMachineImage&pagesize=1&projectsornamespaces=a` });
    });

    it('should not send a request for an unknown resource type', () => {
      expect(filteredCountRequest(createGetters(), createRootGetters(), 'unknown')).toBeNull();
    });
  });

  describe('fetchFilteredCounts', () => {
    it('should save the count of each response', async() => {
      const { context, state, request } = createContext({ responses: { 'spec.type!%3D': { count: 9 }, 'spec.type%3D': { count: 2 } } });

      await harvesterActions.fetchFilteredCounts(context as any, [HCI.BACKUP, HCI.VM_SNAPSHOT]);

      expect(request).toHaveBeenCalledTimes(2);
      expect(state.filteredCounts).toStrictEqual({ [HCI.BACKUP]: 9, [HCI.VM_SNAPSHOT]: 2 });
    });

    it('should request all nav items by default', async() => {
      const { context, state, request } = createContext();

      await harvesterActions.fetchFilteredCounts(context as any);

      expect(request).toHaveBeenCalledTimes(Object.keys(SERVER_FILTERED_COUNTS).length);
      expect(Object.keys(state.filteredCounts)).toStrictEqual(Object.keys(SERVER_FILTERED_COUNTS));
    });

    it('should save 0 when the response has no count, as Steve leaves it out when nothing matches', async() => {
      const { context, state } = createContext({ responses: { [STORAGE_CLASS]: { data: [] } } });

      await harvesterActions.fetchFilteredCounts(context as any, [HCI.STORAGE]);

      expect(state.filteredCounts).toStrictEqual({ [HCI.STORAGE]: 0 });
    });

    it('should save no count when the response has resources but no count, as Harvester v1.3 ignores the query', async() => {
      const { context, state } = createContext({ responses: { [STORAGE_CLASS]: { data: [{}, {}] } } });

      await harvesterActions.fetchFilteredCounts(context as any, [HCI.STORAGE]);

      expect(state.filteredCounts).toStrictEqual({ [HCI.STORAGE]: null });
    });

    it('should save no count when the request fails', async() => {
      const { context, state } = createContext({ responses: { [CONFIG_MAP]: new Error('500') } });

      await harvesterActions.fetchFilteredCounts(context as any, [HCI.CLOUD_TEMPLATE]);

      expect(state.filteredCounts).toStrictEqual({ [HCI.CLOUD_TEMPLATE]: null });
    });

    it('should save 0 without a request for an empty namespace selection', async() => {
      const { context, state, request } = createContext({ rootGetters: createRootGetters({ isAllNamespaces: false, namespaces: {} }) });

      await harvesterActions.fetchFilteredCounts(context as any, [HCI.BACKUP]);

      expect(request).not.toHaveBeenCalled();
      expect(state.filteredCounts).toStrictEqual({ [HCI.BACKUP]: 0 });
    });

    it('should ignore the response of an outdated request', async() => {
      const { context, state } = createContext();
      let resolveFirst: any;

      context.dispatch = jest.fn()
        .mockImplementationOnce(() => new Promise((resolve) => {
          resolveFirst = resolve;
        }))
        .mockImplementationOnce(() => Promise.resolve({ count: 5 }));

      const first = harvesterActions.fetchFilteredCounts(context as any, [HCI.BACKUP]);

      await harvesterActions.fetchFilteredCounts(context as any, [HCI.BACKUP]);
      resolveFirst({ count: 3 });
      await first;

      expect(state.filteredCounts).toStrictEqual({ [HCI.BACKUP]: 5 });
    });

    it('should ignore the response of a request of the previous cluster', async() => {
      const { context, state } = createContext();
      let resolveFirst: any;

      context.dispatch = jest.fn()
        .mockImplementationOnce(() => new Promise((resolve) => {
          resolveFirst = resolve;
        }))
        .mockImplementationOnce(() => Promise.resolve({ count: 5 }));

      const first = harvesterActions.fetchFilteredCounts(context as any, [HCI.BACKUP]);

      context.commit('resetFilteredCounts');
      await harvesterActions.fetchFilteredCounts(context as any, [HCI.BACKUP]);
      resolveFirst({ count: 3 });
      await first;

      expect(state.filteredCounts).toStrictEqual({ [HCI.BACKUP]: 5 });
    });
  });

  describe('watchFilteredCounts', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /**
     * Runs `watchFilteredCounts` with a fake `store.watch`, which records the
     * watch callbacks by the value of their getter.
     */
    function watch(contextArgs: any = {}) {
      const { context, state, request } = createContext(contextArgs);
      const watchers: { getter: () => any, cb: () => void }[] = [];
      const unwatch = jest.fn();
      const store = {
        watch: jest.fn((getter: () => any, cb: () => void) => {
          watchers.push({ getter, cb });

          return unwatch;
        })
      };
      const done = harvesterActions.watchFilteredCounts.call(store, context, { clusterId: 'local' });

      return {
        context, state, request, watchers, unwatch, done
      };
    }

    it('should request all counts right away', async() => {
      const { request, done } = watch();

      await done;

      expect(request).toHaveBeenCalledTimes(Object.keys(SERVER_FILTERED_COUNTS).length);
    });

    it('should watch the counts endpoint per resource type, and the namespace filter', async() => {
      const { watchers, done } = watch({ getters: createGetters({ counts: { [STORAGE_CLASS]: { summary: { count: 4 } } } }) });

      await done;

      // VirtualMachineBackup, VolumeSnapshot, StorageClass, ConfigMap, NAD, PVC, DataVolume + the namespace filter
      expect(watchers).toHaveLength(8);
      expect(watchers.map(({ getter }) => getter())).toContain(JSON.stringify({ summary: { count: 4 } }));
    });

    it('should request the counts of a resource type again, once, when its numbers change', async() => {
      const { watchers, request, done } = watch();

      await done;
      request.mockClear();

      // The first watcher is the one of VirtualMachineBackup, the type of the first nav items
      const backupWatcher = watchers[0];

      backupWatcher.cb();
      backupWatcher.cb();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // VM backups and VM snapshots, both VirtualMachineBackup resources
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('should request the namespaced counts again when the namespace filter changes', async() => {
      const { watchers, request, done } = watch();

      await done;
      request.mockClear();
      watchers[watchers.length - 1].cb();
      await Promise.resolve();

      const urls = request.mock.calls.map(([{ url }]: any) => url);

      expect(urls).toHaveLength(6);
      expect(urls.some((url: string) => url.includes(STORAGE_CLASS) || url.includes(NETWORK_ATTACHMENT))).toBe(false);
    });

    it('should not request anything once another cluster is shown', async() => {
      const rootGetters = createRootGetters();
      const { watchers, request, done } = watch({ rootGetters });

      await done;
      request.mockClear();
      rootGetters.clusterId = 'c-other';
      watchers[watchers.length - 1].cb();
      await Promise.resolve();

      expect(request).not.toHaveBeenCalled();
    });

    it('should not request anything once another product is shown', async() => {
      const rootGetters = createRootGetters();
      const { watchers, request, done } = watch({ rootGetters });

      await done;
      request.mockClear();
      rootGetters.currentProduct = { inStore: 'cluster' };
      watchers[watchers.length - 1].cb();
      await Promise.resolve();

      expect(request).not.toHaveBeenCalled();
    });

    it('should not request anything for a change seen just before the watchers were stopped', async() => {
      const { context, watchers, request, done } = watch();

      await done;
      request.mockClear();
      watchers[0].cb();
      await harvesterActions.watchFilteredCounts.call({ watch: jest.fn(() => jest.fn()) }, context, { clusterId: 'local' });
      request.mockClear();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(request).not.toHaveBeenCalled();
    });

    it('should cope with the store module being unregistered when logging out', async() => {
      const getters: any = createGetters();
      const { watchers, done } = watch({ getters });

      await done;
      delete getters.all;

      expect(watchers[0].getter()).toBe('null');
    });

    it('should keep the watchers when a cluster left while it was loading finishes loading', async() => {
      const { context, unwatch, request, done } = watch();

      await done;
      request.mockClear();

      const store = { watch: jest.fn() };

      await harvesterActions.watchFilteredCounts.call(store, context, { clusterId: 'c-left' });

      expect(store.watch).not.toHaveBeenCalled();
      expect(unwatch).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
    });

    it('should stop the watchers of the previous cluster', async() => {
      const { context, unwatch, done } = watch();

      await done;
      await harvesterActions.watchFilteredCounts.call({ watch: jest.fn(() => jest.fn()) }, context, { clusterId: 'local' });

      expect(unwatch).toHaveBeenCalledTimes(8);
    });
  });
});
