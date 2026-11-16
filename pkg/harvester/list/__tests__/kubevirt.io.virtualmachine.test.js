import { PVC, PV, POD } from '@shell/config/types';
import ResourceTable from '@shell/components/ResourceTable';
import PaginatedResourceTable from '@shell/components/PaginatedResourceTable';
import VmList, { VM_HEADERS } from '../kubevirt.io.virtualmachine.vue';
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
  featureEnabled = true, paginationEnabled = true, found = {}, failing = [], vmSchema = SCHEMAS[HCI.VM], storedVMs = []
} = {}) {
  const dispatch = jest.fn((action, { type } = {}) => (failing.includes(type) ? Promise.reject(new Error('failed')) : Promise.resolve(found[type] || [])));

  return {
    dispatch,
    getters: {
      currentProduct:                       { inStore: 'harvester' },
      'harvester-common/getFeatureEnabled': (name) => featureEnabled && name === 'vmListPagination',
      'harvester/paginationEnabled':        ({ id, context }) => paginationEnabled && id === HCI.VM && context === VM_LIST_PAGINATION_CONTEXT,
      'harvester/schemaFor':                (type) => (type === HCI.VM ? vmSchema : SCHEMAS[type]),
      'harvester/all':                      (type) => (type === HCI.VM ? storedVMs : []),
    }
  };
}

const call = (name, ctx) => VmList.computed[name].call(ctx);

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
    ])('should list every VM with ResourceTable when %s', (_, opts) => {
      const $store = createStore(opts);

      expect(call('canPaginate', { $store })).toBe(false);
      expect(call('tableComponent', { canPaginate: false })).toBe(ResourceTable);
    });

    it('should show VMIs without a VM', () => {
      const ctx = {
        canPaginate: false,
        allVMs:      [{ id: 'default/a' }],
        allVMIs:     [{ id: 'default/a' }, { id: 'default/orphan' }],
      };

      expect(call('rows', ctx).map(({ id }) => id)).toStrictEqual(['default/a', 'default/orphan']);
      expect(call('tableProps', { ...ctx, rows: call('rows', ctx) })).toStrictEqual({ rows: call('rows', ctx) });
    });

    it('should load the VMs and what the rows need itself', async() => {
      const $store = createStore({ featureEnabled: false });
      const ctx = {
        $store, canPaginate: false, inStore: 'harvester', hasNode: false
      };

      await VmList.fetch.call(ctx);

      expect($store.dispatch).toHaveBeenCalledWith('harvester/findAll', { type: HCI.VM, opt: { force: true } });
      expect($store.dispatch).toHaveBeenCalledWith('harvester/findAll', { type: POD });
    });
  });

  describe('with server-side pagination', () => {
    it('should use PaginatedResourceTable with the VM list context', () => {
      const $store = createStore();

      expect(call('canPaginate', { $store })).toBe(true);
      expect(call('tableComponent', { canPaginate: true })).toBe(PaginatedResourceTable);
    });

    it('should leave the fetch to PaginatedResourceTable', async() => {
      const $store = createStore();

      await VmList.fetch.call({ $store, canPaginate: true });

      expect($store.dispatch).not.toHaveBeenCalled();
    });

    it('should only sort and search on fields the API indexes', () => {
      const ctx = {
        canPaginate:                 true,
        paginationContext:           VM_LIST_PAGINATION_CONTEXT,
        headers:                     VM_HEADERS,
        schema:                      SCHEMAS[HCI.VM],
        fetchSecondaryResources:     jest.fn(),
        fetchPageSecondaryResources: jest.fn(),
      };
      const props = call('tableProps', ctx);
      const byName = Object.fromEntries(props.paginationHeaders.map((h) => [h.name, { sort: h.sort, search: h.search }]));

      expect(props.context).toBe(VM_LIST_PAGINATION_CONTEXT);
      expect(props.fetchSecondaryResources).toBe(ctx.fetchSecondaryResources);
      expect(props.fetchPageSecondaryResources).toBe(ctx.fetchPageSecondaryResources);
      expect(byName).toStrictEqual({
        state:     { sort: ['metadata.fields.2'], search: false },
        name:      { sort: ['metadata.name'], search: ['metadata.name', 'metadata.annotations[harvesterhci.io/vmDisplayName]'] },
        namespace: { sort: ['metadata.namespace'], search: 'metadata.namespace' },
        CPU:       { sort: false, search: false },
        Memory:    { sort: false, search: false },
        ip:        { sort: false, search: false },
        age:       { sort: 'metadata.creationTimestamp:desc', search: false },
      });
    });

    it('should take the VMs of the page from the store', () => {
      const storedVMs = [vm('default', 'a')];
      const $store = createStore({ storedVMs });

      expect(call('vms', {
        $store, canPaginate: true, inStore: 'harvester', allVMs: []
      })).toBe(storedVMs);
    });

    it('should list only the VMs of the page', () => {
      const page = [vm('default', 'a')];

      expect(call('rows', {
        canPaginate: true, vms: page, allVMIs: [{ id: 'default/orphan' }]
      })).toBe(page);
    });

    it('should fetch only the resources of the VMs on the page', async() => {
      const $store = createStore({
        found: {
          [PVC]:         [{ spec: { volumeName: 'pv-a' } }, { spec: {} }],
          [HCI.RESTORE]: [{ spec: { virtualMachineBackupName: 'backup-a' } }],
        }
      });
      const ctx = { $store, inStore: 'harvester' };

      ctx.findPageByField = VmList.methods.findPageByField.bind(ctx);
      ctx.printerColumnField = VmList.methods.printerColumnField.bind(ctx);

      await VmList.methods.fetchPageSecondaryResources.call(ctx, {
        force: false,
        page:  [vm('default', 'a', ['a-disk']), vm('other', 'a'), vm('default', 'b', ['b-disk'])],
      });

      const filters = Object.fromEntries($store.dispatch.mock.calls.map(([action, { type, opt }]) => {
        expect(action).toBe('harvester/findPage');

        return [type, opt.pagination.filters[0].fields.map(({ field, value, equality }) => `${ field }${ equality }(${ value })`)];
      }));

      expect(filters).toStrictEqual({
        [PVC]:         ['metadata.name IN (a-disk,b-disk)'],
        [HCI.RESTORE]: ['metadata.fields.2 IN (a,b)'],
        [HCI.VMI]:     ['metadata.name IN (a,b)'],
        [POD]:         ['metadata.labels[harvesterhci.io/vmName] IN (a,b)'],
        [HCI.VMIM]:    ['metadata.fields.2 IN (a,b)'],
        [PV]:          ['metadata.name IN (pv-a)'],
        [HCI.BACKUP]:  ['metadata.name IN (backup-a)'],
      });
    });

    it('should fetch the rest when one request fails', async() => {
      const $store = createStore({ failing: [HCI.RESTORE], found: { [PVC]: [{ spec: { volumeName: 'pv-a' } }] } });
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
    });
  });

  it('should hide the masthead loading count only with pagination', () => {
    expect(VmList.$loadingResources(null, createStore())).toStrictEqual({ loadResources: [] });
    expect(VmList.$loadingResources(null, createStore({ featureEnabled: false }))).toStrictEqual({});
  });
});
