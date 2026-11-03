import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { LONGHORN } from '@shell/config/types';
import VmCloneProgress from '../vm-clone-progress';

// A component using the mixin for the given VMs, with the Longhorn schemas present unless `schemas` is false
function mountWithVMs(vms, { schemas = true, findAll = jest.fn(() => Promise.resolve([])) } = {}) {
  const wrapper = shallowMount({
    mixins:   [VmCloneProgress],
    props:    { vms: { type: Array, default: () => [] } },
    computed: {
      cloneProgressVMs() {
        return this.vms;
      }
    },
    template: '<div />',
  }, {
    props:  { vms },
    global: {
      mocks: {
        $store: {
          getters: {
            currentProduct:        { inStore: 'harvester' },
            'harvester/schemaFor': () => (schemas ? {} : null),
          },
          dispatch: findAll,
        },
      },
    },
  });

  return { wrapper, findAll };
}

const types = (findAll) => findAll.mock.calls.map(([, { type }]) => type);

describe('mixin: vm-clone-progress', () => {
  it('should not load any Longhorn resource when no VM was cloned', () => {
    const { findAll } = mountWithVMs([{ hasPendingLonghornClone: false, isCloningVolumes: false }]);

    expect(findAll).not.toHaveBeenCalled();
  });

  it('should only load Longhorn volumes for a VM with Longhorn clone targets that is not copying', () => {
    const { findAll } = mountWithVMs([{ hasPendingLonghornClone: true, isCloningVolumes: false }]);

    expect(findAll).toHaveBeenCalledWith('harvester/findAll', { type: LONGHORN.VOLUMES });
    expect(types(findAll)).toStrictEqual([LONGHORN.VOLUMES]);
  });

  it('should load the engines while a clone is in progress', () => {
    const { findAll } = mountWithVMs([{ hasPendingLonghornClone: true, isCloningVolumes: true }]);

    expect(types(findAll)).toStrictEqual([LONGHORN.VOLUMES, LONGHORN.ENGINES]);
  });

  it('should load a type only once, also when VMs start cloning later', async() => {
    const { wrapper, findAll } = mountWithVMs([]);

    await wrapper.setProps({ vms: [{ hasPendingLonghornClone: true, isCloningVolumes: true }] });
    await wrapper.setProps({ vms: [] });
    await wrapper.setProps({ vms: [{ hasPendingLonghornClone: true, isCloningVolumes: true }] });

    expect(types(findAll)).toStrictEqual([LONGHORN.VOLUMES, LONGHORN.ENGINES]);
  });

  it('should not load types the user has no schema for', () => {
    const { findAll } = mountWithVMs([{ hasPendingLonghornClone: true, isCloningVolumes: true }], { schemas: false });

    expect(findAll).not.toHaveBeenCalled();
  });

  it('should retry a type whose load failed', async() => {
    const findAll = jest.fn(() => Promise.reject(new Error('forbidden')));
    const { wrapper } = mountWithVMs([{ hasPendingLonghornClone: true, isCloningVolumes: false }], { findAll });

    await nextTick();
    expect(wrapper.vm.cloneProgressLoaded[LONGHORN.VOLUMES]).toBe(false);

    wrapper.vm.loadCloneProgressType(LONGHORN.VOLUMES);

    expect(findAll).toHaveBeenCalledTimes(2);
  });
});
