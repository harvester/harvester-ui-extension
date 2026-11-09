import { shallowMount } from '@vue/test-utils';
import HarvesterBackupModal from '../HarvesterBackupModal.vue';
import { HCI } from '../../types';

const OPTIONS = {
  backup: {
    value: 'backup', label: 'Native', disabled: true, unavailableReason: 'native reason'
  },
  restic: {
    value: 'restic', label: 'Restic', disabled: false
  },
  kopia: {
    value: 'kopia', label: 'Kopia', disabled: false
  },
};

function mountModal({
  enabled = true, options = Object.values(OPTIONS), doAction = jest.fn().mockResolvedValue({ _status: 204 }), save = jest.fn().mockResolvedValue()
} = {}) {
  const vm = {
    metadata:                       { name: 'vm1', namespace: 'ns1' },
    thirdPartyBackupFeatureEnabled: enabled,
    backupTypeOptions:              options,
    fetchBackupTypeRequirements:    jest.fn().mockResolvedValue(),
    doAction,
  };
  const dispatch = jest.fn((action) => (action === 'harvester/create' ? Promise.resolve({ save }) : Promise.resolve()));
  const wrapper = shallowMount(HarvesterBackupModal, {
    props:  { resources: [vm] },
    global: {
      stubs: {
        Banner: { template: '<div><slot /></div>' },
        Card:   { template: '<div><slot name="title" /><slot name="body" /><slot name="actions" /></div>' },
      },
      mocks: {
        t:           (key) => key,
        $fetchState: { pending: false },
        $store:      {
          dispatch,
          getters: {
            'i18n/t':                             (key) => key,
            'harvester-common/getFeatureEnabled': () => false,
          },
        },
      },
    },
  });

  return {
    wrapper, vm, dispatch, doAction, save
  };
}

describe('component: HarvesterBackupModal', () => {
  it('should keep the plain dialog while the feature is off', async() => {
    const { wrapper, doAction, dispatch } = mountModal({ enabled: false });

    expect(wrapper.find('[data-testid="backup-type-select"]').exists()).toBe(false);

    await wrapper.setData({ backUpName: 'b1' });
    await wrapper.vm.save();

    expect(doAction).toHaveBeenCalledWith('backup', expect.objectContaining({ name: 'b1' }), {}, false);
    expect(dispatch).not.toHaveBeenCalledWith('harvester/create', expect.anything());
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('should load the requirements and select the first available type', async() => {
    const { wrapper, vm } = mountModal();

    await HarvesterBackupModal.fetch.call(wrapper.vm);

    expect(vm.fetchBackupTypeRequirements).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.backupType).toBe('restic');
  });

  it('should keep native on the backup action', async() => {
    const { wrapper, doAction, dispatch } = mountModal();

    await wrapper.setData({ backUpName: 'b1', backupType: 'backup' });
    await wrapper.vm.save();

    expect(doAction).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith('harvester/create', expect.anything());
  });

  it('should create Kopia directly, without an owner reference on the VM', async() => {
    const {
      wrapper, doAction, dispatch, save
    } = mountModal();

    await wrapper.setData({ backUpName: 'b1', backupType: 'kopia' });
    await wrapper.vm.save();

    expect(doAction).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);

    const [, resource] = dispatch.mock.calls.find(([action]) => action === 'harvester/create');

    expect(resource.type).toBe(HCI.BACKUP);
    expect(resource.metadata).toStrictEqual({ name: 'b1', namespace: 'ns1' });
    expect(resource.spec.type).toBe('kopia');
    expect(resource.spec.source.name).toBe('vm1');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('should show the webhook error and stay open', async() => {
    const { wrapper } = mountModal({ save: jest.fn().mockRejectedValue({ status: 422, message: 'vm is in migration' }) });

    await wrapper.setData({ backUpName: 'b1', backupType: 'kopia' });
    await wrapper.vm.save();

    expect(wrapper.vm.errors).toStrictEqual(['vm is in migration']);
    expect(wrapper.vm.saving).toBe(false);
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('should list the reasons of unavailable types next to the select', async() => {
    const { wrapper } = mountModal();

    await HarvesterBackupModal.fetch.call(wrapper.vm);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="backup-type-unavailable"]').exists()).toBe(true);
    expect(wrapper.findAll('li').map((li) => li.text())).toStrictEqual(['Native: native reason']);
  });

  it('should explain why when no type is available and hide the form', async() => {
    const disabled = Object.values(OPTIONS).map((option) => ({
      ...option, disabled: true, unavailableReason: `${ option.value } reason`
    }));
    const { wrapper } = mountModal({ options: disabled });

    await HarvesterBackupModal.fetch.call(wrapper.vm);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.noBackupTypeAvailable).toBe(true);
    expect(wrapper.vm.canCreate).toBe(false);
    expect(wrapper.find('[data-testid="backup-type-select"]').exists()).toBe(false);
    expect(wrapper.findAll('li').map((li) => li.text())).toStrictEqual([
      'Native: backup reason', 'Restic: restic reason', 'Kopia: kopia reason'
    ]);
  });
});
