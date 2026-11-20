import { shallowMount, flushPromises } from '@vue/test-utils';
import { FORKLIFT_NAMESPACE } from '../../../config/harvester-map';
import ReviewMigrationStep from '../ReviewMigrationStep.vue';

const PLAN = 'forklift.konveyor.io.plan';

// The resources created by the wizard, by type
const created = {};

const mockStore = {
  getters: {
    currentProduct:  { inStore: 'harvester' },
    'harvester/all': () => [],
    'i18n/t':        (key) => key,
    'i18n/exists':   () => true,
  },
  dispatch: jest.fn((action, payload) => {
    if (action === 'harvester/create') {
      const resource = {
        ...payload,
        save:           jest.fn(() => Promise.resolve()),
        startMigration: jest.fn(() => Promise.resolve()),
      };

      created[payload.type] = resource;

      return Promise.resolve(resource);
    }

    return Promise.resolve([]);
  }),
};

jest.mock('vuex', () => ({
  ...jest.requireActual('vuex'),
  useStore: () => mockStore,
}));

function mountStep() {
  return shallowMount(ReviewMigrationStep, {
    props: {
      providerName:   'vsphere',
      selectedVms:    [{ id: 'vm-1', name: 'web-1' }, { id: 'vm-2' }],
      mappingEntries: { networkEntries: [], storageEntries: [] },
      stepData:       { planName: 'plan-1', targetNamespace: 'default' },
    },
  });
}

describe('component: ReviewMigrationStep', () => {
  it('should create a cold migration plan that deletes the guest conversion pod after a successful migration', async() => {
    const wrapper = mountStep();

    await flushPromises();
    await wrapper.vm.startMigration();

    const plan = created[PLAN];

    expect(plan.metadata).toStrictEqual({ name: 'plan-1', namespace: FORKLIFT_NAMESPACE });
    expect(plan.spec.deleteGuestConversionPod).toBe(true);
    expect(plan.spec.warm).toBe(false);
    expect(plan.spec.targetNamespace).toBe('default');
    expect(plan.spec.vms).toStrictEqual([{ id: 'vm-1', name: 'web-1' }, { id: 'vm-2', name: 'vm-2' }]);
    expect(plan.save).toHaveBeenCalledWith();
    expect(plan.startMigration).toHaveBeenCalledWith();
  });
});
