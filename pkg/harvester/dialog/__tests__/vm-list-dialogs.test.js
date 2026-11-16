import { PVC, STORAGE_CLASS } from '@shell/config/types';
import HotplugVolumeModal from '../HarvesterAddHotplugVolumeModal.vue';
import StorageMigrationDialog from '../HarvesterStorageMigrationDialog.vue';
import RestoreDialog from '../HarvesterRestoreDialog.vue';
import { HCI } from '../../types';

// The dialogs of the VM list read the VMs, PVCs and backups of the VM's namespace through the VM, so a paged VM list
// keeps its page (see `findInNamespace` in the VM model)
describe('dialogs of the VM list', () => {
  const vm = (claims = []) => ({
    metadata:        { namespace: 'default', name: 'vm' },
    spec:            { template: { spec: { volumes: claims.map((claimName) => ({ persistentVolumeClaim: { claimName } })) } } },
    findInNamespace: jest.fn((type) => Promise.resolve([{ type }])),
  });

  it('should load the PVCs and VMs of Add Volume through the VM', async() => {
    const actionResource = vm();
    const dispatch = jest.fn(() => Promise.resolve([]));
    const dialog = { actionResource, $store: { dispatch } };

    await HotplugVolumeModal.fetch.call(dialog);

    expect(actionResource.findInNamespace.mock.calls).toStrictEqual([[PVC], [HCI.VM]]);
    expect(dialog.allPVCs).toStrictEqual([{ type: PVC }]);
    expect(dialog.allVMs).toStrictEqual([{ type: HCI.VM }]);
    expect(dispatch.mock.calls).toStrictEqual([['harvester/findAll', { type: STORAGE_CLASS }]]);
  });

  it('should load the PVCs and VMs of Storage Migration through the VM', async() => {
    const actionResource = vm();
    const dialog = { actionResource };

    await StorageMigrationDialog.fetch.call(dialog);

    expect(actionResource.findInNamespace.mock.calls).toStrictEqual([[PVC], [HCI.VM]]);
    expect(dialog.allPVCs).toStrictEqual([{ type: PVC }]);
    expect(dialog.namespaceVMs).toStrictEqual([{ type: HCI.VM }]);
  });

  it('should exclude the volumes of the loaded VMs from the Storage Migration targets', () => {
    const used = StorageMigrationDialog.computed.vmUsedVolumeNames.call({ namespaceVMs: [vm(['a-disk']), vm(['b-disk'])] });

    expect([...used]).toStrictEqual(['default/a-disk', 'default/b-disk']);
  });

  it('should load the backups of Restore through the VM', async() => {
    const actionResource = vm();
    const dialog = { actionResource };

    await RestoreDialog.fetch.call(dialog);

    expect(actionResource.findInNamespace.mock.calls).toStrictEqual([[HCI.BACKUP]]);
    expect(dialog.backups).toStrictEqual([{ type: HCI.BACKUP }]);
  });
});
