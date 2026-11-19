import { shallowMount } from '@vue/test-utils';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import DriverLonghornIOV2, { CLONE_MODE } from '../driver.longhorn.io_v2.vue';

function storageClass(parameters) {
  return { parameters, thirdPartyStorageFeatureEnabled: true };
}

function mountForm({
  value = storageClass(), mode = _CREATE, realMode = mode, linkedClone = true
} = {}) {
  return shallowMount(DriverLonghornIOV2, {
    props:  {
      value, mode, realMode
    },
    global: {
      mocks: {
        t:      (key) => key,
        $store: {
          getters: {
            currentProduct:                         { inStore: 'harvester' },
            'harvester/all':                        () => [],
            'harvester-common/getFeatureEnabled':   (feature) => feature === 'longhornV2LinkedClone' && linkedClone,
          },
        },
      },
    },
  });
}

describe('component: DriverLonghornIOV2 clone mode', () => {
  it('should show the clone mode field when the cluster supports linked clones', () => {
    const wrapper = mountForm();

    expect(wrapper.find('[data-testid="clone-mode"]').exists()).toBe(true);
  });

  it('should hide the clone mode field on clusters without linked clone support', () => {
    const wrapper = mountForm({ linkedClone: false });

    expect(wrapper.find('[data-testid="clone-mode"]').exists()).toBe(false);
  });

  it('should default to full copy without adding the parameter', () => {
    const wrapper = mountForm();

    expect(wrapper.vm.cloneMode).toBe(CLONE_MODE.FULL_COPY);
    expect(wrapper.props('value').parameters.cloneMode).toBeUndefined();
  });

  it('should set the cloneMode parameter when linked clone is selected', () => {
    const wrapper = mountForm();

    wrapper.vm.cloneMode = CLONE_MODE.LINKED_CLONE;

    expect(wrapper.props('value').parameters.cloneMode).toBe('linked-clone');
    expect(wrapper.props('value').parameters.dataEngine).toBe('v2');
  });

  it('should remove the cloneMode parameter when switching back to full copy', () => {
    const wrapper = mountForm();

    wrapper.vm.cloneMode = CLONE_MODE.LINKED_CLONE;
    wrapper.vm.cloneMode = CLONE_MODE.FULL_COPY;

    expect('cloneMode' in wrapper.props('value').parameters).toBe(false);
  });

  it('should show the clone mode of an existing storage class and keep it out of the custom parameters', () => {
    const value = storageClass({
      dataEngine: 'v2', numberOfReplicas: '1', cloneMode: 'linked-clone', custom: 'yes'
    });
    const wrapper = mountForm({ value, mode: _VIEW });

    expect(wrapper.vm.cloneMode).toBe(CLONE_MODE.LINKED_CLONE);
    expect(wrapper.vm.parameters).toStrictEqual({ custom: 'yes' });
  });
});
