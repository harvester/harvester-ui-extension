import HotplugVolumeModal from '../HarvesterAddHotplugVolumeModal.vue';
import { HCI } from '../../types';

describe('dialog: HarvesterAddHotplugVolumeModal', () => {
  function createDialog({ havePage }) {
    const dispatch = jest.fn((action) => Promise.resolve(action.endsWith('/findPage') ? { data: [{ id: 'default/other' }] } : [{ id: 'all' }]));
    const dialog = {
      actionResource: { id: 'default/vm', metadata: { namespace: 'default' } },
      $store:         {
        dispatch,
        getters: { 'harvester/havePage': (type) => havePage && type === HCI.VM }
      }
    };

    return { dialog, dispatch };
  }

  it('should load every VM when the VM list is not paged', async() => {
    const { dialog, dispatch } = createDialog({ havePage: false });

    await expect(HotplugVolumeModal.methods.findNamespaceVMs.call(dialog)).resolves.toStrictEqual([{ id: 'all' }]);
    expect(dispatch.mock.calls).toStrictEqual([['harvester/findAll', { type: HCI.VM }]]);
  });

  it('should only read the VMs of the namespace, without storing them, when the VM list is paged', async() => {
    const { dialog, dispatch } = createDialog({ havePage: true });

    await expect(HotplugVolumeModal.methods.findNamespaceVMs.call(dialog)).resolves.toStrictEqual([{ id: 'default/other' }]);
    expect(dispatch).toHaveBeenCalledTimes(1);

    const [action, { type, opt }] = dispatch.mock.calls[0];

    expect(action).toBe('harvester/findPage');
    expect(type).toBe(HCI.VM);
    expect(opt.transient).toBe(true);
    expect(opt.pagination.filters[0].fields.map(({ field, value }) => `${ field }=${ value }`)).toStrictEqual(['metadata.namespace=default']);
  });
});
