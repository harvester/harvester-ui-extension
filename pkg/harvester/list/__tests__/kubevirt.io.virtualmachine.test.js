import {
  PVC, PV, POD, NODE, STORAGE_CLASS
} from '@shell/config/types';
import VmList from '../kubevirt.io.virtualmachine.vue';
import { VM_HEADERS, VM_PAGINATION_HEADERS } from '../../config/table-headers';
import { HCI } from '../../types';
import { VM_LIST_PAGINATION_CONTEXT } from '../../config/harvester';

const schemaWithColumns = (id, columns) => ({
  id,
  attributes: { columns: columns.map((name, i) => ({ name, field: `$.metadata.fields[${ i }]` })) }
});

const SCHEMAS = {
  [HCI.VM]:      schemaWithColumns(HCI.VM, ['Name', 'Age', 'Status', 'Ready']),
  [HCI.VMIM]:    schemaWithColumns(HCI.VMIM, ['Name', 'Phase', 'VMI']),
  [HCI.RESTORE]: schemaWithColumns(HCI.RESTORE, ['Name', 'TARGET_KIND', 'TARGET_NAME']),
  [HCI.VMI]:     { id: HCI.VMI },
  [HCI.BACKUP]:  { id: HCI.BACKUP },
  [POD]:         { id: POD },
  [PVC]:         { id: PVC },
  [PV]:          { id: PV },
};

function createStore({
  featureEnabled = true, paginationEnabled = true, found = {}, failing = [], vmSchema = SCHEMAS[HCI.VM], storedVMs = [], storedVMIs = []
} = {}) {
  const dispatch = jest.fn((action, { type } = {}) => (failing.includes(type) ? Promise.reject(new Error('failed')) : Promise.resolve(found[type] || [])));

  return {
    dispatch,
    getters: {
      currentProduct:                       { inStore: 'harvester' },
      'harvester-common/getFeatureEnabled': (name) => featureEnabled && name === 'vmListPagination',
      'harvester/paginationEnabled':        ({ id, context }) => paginationEnabled && id === HCI.VM && context === VM_LIST_PAGINATION_CONTEXT,
      'harvester/schemaFor':                (type) => (type === HCI.VM ? vmSchema : SCHEMAS[type]),
      'harvester/all':                      (type) => ({ [HCI.VM]: storedVMs, [HCI.VMI]: storedVMIs }[type] || []),
      'type-map/headersFor':                (schema, pagination) => (pagination ? VM_PAGINATION_HEADERS : VM_HEADERS),
    }
  };
}

const call = (name, ctx) => VmList.computed[name].call(ctx);
const byName = (headers) => Object.fromEntries(headers.map((h) => [h.name, { sort: h.sort, search: h.search }]));

const vm = (namespace, name, claimNames = []) => ({
  id:                        `${ namespace }/${ name }`,
  metadata:                  { namespace, name },
  persistentVolumeClaimName: claimNames,
});

describe('list: kubevirt.io.virtualmachine', () => {
  describe('without server-side pagination', () => {
    it.each([
      ['the feature is off for the cluster version', { featureEnabled: false }],
      ['the shell does not page the VM list', { paginationEnabled: false }],
      ['the API is not served from the SQL cache', { vmSchema: { id: HCI.VM, attributes: { columns: [{ name: 'Status', field: '.status.printableStatus' }] } } }],
    ])('should not give the table the context when %s', (_, opts) => {
      const $store = createStore(opts);

      expect(call('canPaginate', { $store })).toBe(false);
      expect(call('paginationContext', { canPaginate: false })).toBeNull();
    });

    it('should add the node and restore columns to the product\'s VM columns', () => {
      const ctx = {
        $store: createStore({ featureEnabled: false }), schema: SCHEMAS[HCI.VM], hasNode: true, hasBackUpRestoreInProgress: true
      };

      ctx.withListColumns = VmList.methods.withListColumns.bind(ctx);
      const headers = call('headers', ctx);

      expect(headers.map(({ name }) => name)).toStrictEqual(['state', 'name', 'namespace', 'CPU', 'Memory', 'ip', 'node', 'restoreProgress', 'age']);
      expect(byName(headers).CPU).toStrictEqual({ sort: ['displayCPU'], search: undefined });
      expect(byName(headers).node).toStrictEqual({ sort: ['realAttachNodeName'], search: undefined });
    });

    it('should add VMIs without a VM to the rows', () => {
      const vms = [{ id: 'default/a' }];
      const $store = createStore({ storedVMs: vms, storedVMIs: [{ id: 'default/a' }, { id: 'default/orphan' }] });
      const ctx = {
        $store, inStore: 'harvester', canPaginate: false, vms
      };

      ctx.vmisWithoutVM = call('vmisWithoutVM', ctx);

      expect(VmList.methods.addVMIsWithoutVM.call(ctx, vms).map(({ id }) => id)).toStrictEqual(['default/a', 'default/orphan']);
      expect(call('rows', ctx).map(({ id }) => id)).toStrictEqual(['default/a', 'default/orphan']);
    });

    it('should load every resource the rows need, the table loads the VMs', async() => {
      const $store = createStore({ featureEnabled: false });

      await VmList.methods.fetchSecondaryResources.call({
        $store, inStore: 'harvester', hasNode: true
      }, { canPaginate: false });

      expect($store.dispatch.mock.calls.map(([action, { type }]) => `${ action } ${ type }`).sort()).toStrictEqual([
        HCI.BACKUP, HCI.IMAGE, HCI.RESTORE, HCI.VMI, HCI.VMIM, NODE, POD, PV, PVC, STORAGE_CLASS
      ].map((type) => `harvester/findAll ${ type }`).sort());
    });
  });

  describe('with server-side pagination', () => {
    it('should give the table the VM list context', () => {
      const $store = createStore();

      expect(call('canPaginate', { $store })).toBe(true);
      expect(call('paginationContext', { canPaginate: true })).toBe(VM_LIST_PAGINATION_CONTEXT);
    });

    it('should only sort and search on fields the API indexes', () => {
      const ctx = {
        $store: createStore(), schema: SCHEMAS[HCI.VM], hasNode: true, hasBackUpRestoreInProgress: true
      };

      ctx.withListColumns = VmList.methods.withListColumns.bind(ctx);

      expect(byName(call('paginationHeaders', ctx))).toStrictEqual({
        state:           { sort: ['metadata.fields.2'], search: false },
        name:            { sort: ['metadata.name'], search: ['metadata.name', 'metadata.annotations[harvesterhci.io/vmDisplayName]'] },
        namespace:       { sort: ['metadata.namespace'], search: 'metadata.namespace' },
        CPU:             { sort: false, search: false },
        Memory:          { sort: false, search: false },
        ip:              { sort: false, search: false },
        node:            { sort: false, search: false },
        restoreProgress: { sort: false, search: false },
        age:             { sort: 'metadata.creationTimestamp:desc', search: false },
      });
    });

    it('should take the VMs of the page from the store', () => {
      const storedVMs = [vm('default', 'a')];
      const $store = createStore({ storedVMs });

      expect(call('vms', { $store, inStore: 'harvester' })).toBe(storedVMs);
    });

    it('should list only the VMs of the page', () => {
      const page = [vm('default', 'a')];
      const $store = createStore({ storedVMs: page, storedVMIs: [{ id: 'default/orphan' }] });
      const ctx = {
        $store, inStore: 'harvester', canPaginate: true, vms: page
      };

      ctx.vmisWithoutVM = call('vmisWithoutVM', ctx);

      expect(call('rows', ctx)).toStrictEqual(page);
    });

    it('should fetch only the resources of the VMs on the page', async() => {
      const $store = createStore({
        found: {
          [PVC]:         [{ spec: { volumeName: 'pv-a' } }, { spec: {} }],
          [HCI.RESTORE]: [{ spec: { virtualMachineBackupName: 'backup-a' } }],
          [HCI.VMI]:     [{ metadata: { name: 'a', uid: 'uid-a' } }, { metadata: { name: 'b', uid: 'uid-b' } }],
        }
      });
      const ctx = { $store, inStore: 'harvester' };

      ctx.findPageByField = VmList.methods.findPageByField.bind(ctx);
      ctx.printerColumnField = VmList.methods.printerColumnField.bind(ctx);

      await VmList.methods.fetchPageSecondaryResources.call(ctx, {
        force: true,
        page:  [vm('default', 'a', ['a-disk']), vm('other', 'a'), vm('default', 'b', ['b-disk'])],
      });

      const filters = Object.fromEntries($store.dispatch.mock.calls.map(([action, { type, opt }]) => {
        expect(action).toBe('harvester/findPage');
        expect(opt.force).toBe(true);

        return [type, opt.pagination.filters[0].fields.map(({ field, value, equality }) => `${ field }${ equality }(${ value })`)];
      }));

      expect(filters).toStrictEqual({
        [PVC]:         ['metadata.name IN (a-disk,b-disk)'],
        [HCI.RESTORE]: ['metadata.fields.2 IN (a,b)'],
        [HCI.VMI]:     ['metadata.name IN (a,b)'],
        [POD]:         ['metadata.labels[kubevirt.io/created-by] IN (uid-a,uid-b)'],
        [HCI.VMIM]:    ['metadata.fields.2 IN (a,b)'],
        [PV]:          ['metadata.name IN (pv-a)'],
        [HCI.BACKUP]:  ['metadata.name IN (backup-a)'],
      });
    });

    it('should fetch the rest when one request fails', async() => {
      const $store = createStore({ failing: [HCI.RESTORE], found: { [PVC]: [{ spec: { volumeName: 'pv-a' } }], [HCI.VMI]: [{ metadata: { uid: 'uid-a' } }] } });
      const ctx = { $store, inStore: 'harvester' };

      ctx.findPageByField = VmList.methods.findPageByField.bind(ctx);
      ctx.printerColumnField = VmList.methods.printerColumnField.bind(ctx);

      await expect(VmList.methods.fetchPageSecondaryResources.call(ctx, { force: false, page: [vm('default', 'a', ['a-disk'])] })).resolves.toBeUndefined();

      const types = $store.dispatch.mock.calls.map(([, { type }]) => type);

      expect(types).toStrictEqual(expect.arrayContaining([PVC, HCI.VMI, POD, HCI.VMIM, PV]));
      expect(types).not.toContain(HCI.BACKUP);
    });

    it('should not fetch a type when no VM on the page needs it', async() => {
      const $store = createStore();
      const ctx = { $store, inStore: 'harvester' };

      ctx.findPageByField = VmList.methods.findPageByField.bind(ctx);
      ctx.printerColumnField = VmList.methods.printerColumnField.bind(ctx);

      await VmList.methods.fetchPageSecondaryResources.call(ctx, { force: false, page: [vm('default', 'a')] });

      const types = $store.dispatch.mock.calls.map(([, { type }]) => type);

      expect(types).not.toContain(PVC);
      expect(types).not.toContain(PV);
      expect(types).not.toContain(HCI.BACKUP);
      expect(types).not.toContain(POD);
    });

    it('should load only what every row shares, not the per-VM resources', async() => {
      const $store = createStore();

      await VmList.methods.fetchSecondaryResources.call({
        $store, inStore: 'harvester', hasNode: true
      }, { canPaginate: true });

      expect($store.dispatch.mock.calls).toStrictEqual([
        ['harvester/findAll', { type: HCI.IMAGE }],
        ['harvester/findAll', { type: STORAGE_CLASS }],
        ['harvester/findAll', { type: NODE }],
      ]);
    });
  });

  it('should hide the masthead loading count only with pagination', () => {
    expect(VmList.$loadingResources(null, createStore())).toStrictEqual({ loadResources: [] });
    expect(VmList.$loadingResources(null, createStore({ featureEnabled: false }))).toStrictEqual({});
  });

  describe('restart required notification', () => {
    const rvm = (namespace, name) => ({
      id: `${ namespace }/${ name }`, metadata: { namespace, name }, isRestartRequired: true
    });
    const notify = (ctx, vms, oldVms) => VmList.watch.restartRequiredVMs.call(ctx, vms, oldVms);
    const createCtx = (restartNotificationKey) => ({
      $store: { dispatch: jest.fn() },
      t:      (key, args) => `${ key } ${ JSON.stringify(args) }`,
      restartNotificationKey,
    });
    const warning = (count, vmNames) => ['growl/warning', {
      title:   `harvester.notification.restartRequired.title ${ JSON.stringify({ count }) }`,
      message: `harvester.notification.restartRequired.message ${ JSON.stringify({ vmNames }) }`,
      timeout: 10000,
    }, { root: true }];

    it('should only list the VMs that need a restart', () => {
      const a = rvm('default', 'a');

      expect(call('restartRequiredVMs', { vms: [a, { id: 'default/b', isRestartRequired: false }] })).toStrictEqual([a]);
    });

    it('should notify when VMs need a restart', () => {
      const ctx = createCtx('');

      notify(ctx, [rvm('default', 'a'), rvm('default', 'b')], []);

      expect(ctx.$store.dispatch).toHaveBeenCalledWith(...warning(2, 'a, b'));
      expect(ctx.restartNotificationKey).toBe('default/a,default/b');
    });

    it('should notify on a new visit to the list, even when the VMs it saw before are the same', () => {
      const ctx = createCtx('');

      notify(ctx, [rvm('default', 'a')], [rvm('default', 'a')]);

      expect(ctx.$store.dispatch).toHaveBeenCalledWith(...warning(1, 'a'));
    });

    it('should not notify again when a refresh, page or sort brings back the same VMs', () => {
      const ctx = createCtx('default/a,default/b');

      notify(ctx, [rvm('default', 'b'), rvm('default', 'a')], [rvm('default', 'a'), rvm('default', 'b')]);

      expect(ctx.$store.dispatch).not.toHaveBeenCalled();
    });

    it('should notify again when a VM of the same name in another namespace takes its place', () => {
      const ctx = createCtx('');

      notify(ctx, [rvm('ns1', 'a')], []);
      notify(ctx, [rvm('ns2', 'a')], [rvm('ns1', 'a')]);

      expect(ctx.$store.dispatch.mock.calls).toStrictEqual([warning(1, 'a'), ['growl/clear'], warning(1, 'a')]);
    });

    it('should replace the notification when the VMs change', () => {
      const ctx = createCtx('default/a,default/b');

      notify(ctx, [rvm('default', 'a'), rvm('default', 'c')], [rvm('default', 'a'), rvm('default', 'b')]);

      expect(ctx.$store.dispatch.mock.calls).toStrictEqual([['growl/clear'], warning(2, 'a, c')]);
    });

    it('should reset when no VM needs a restart', () => {
      const ctx = createCtx('default/a');

      notify(ctx, [], [rvm('default', 'a')]);

      expect(ctx.$store.dispatch).not.toHaveBeenCalled();
      expect(ctx.restartNotificationKey).toBe('');
    });
  });
});
