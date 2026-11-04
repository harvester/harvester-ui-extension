import { shallowMount } from '@vue/test-utils';
import UpgradeConfig from '@pkg/harvester/components/settings/upgrade-config.vue';

const DEFAULT = JSON.stringify({
  imagePreloadOption: { strategy: { type: 'sequential' } },
  nodeUpgradeOption:  { strategy: { mode: 'auto' } },
  restoreVM:          false,
});

const mountConfig = (config, featureEnabled) => shallowMount(UpgradeConfig, {
  props: {
    mode:  'edit',
    value: { default: DEFAULT, value: config ? JSON.stringify(config) : '' },
  },
  global: {
    mocks: {
      $store: {
        dispatch: jest.fn(),
        getters:  {
          currentProduct:                       { inStore: 'harvester' },
          'harvester/all':                      () => [],
          'i18n/t':                             (key) => key,
          'harvester-common/getFeatureEnabled': (name) => name === 'shutdownVMOnMigrationFailure' && featureEnabled,
        },
      },
    },
  },
});

const savedValue = (wrapper) => JSON.parse(wrapper.props('value').value);

describe('component: upgrade-config', () => {
  it('should default shutdownVMOnMigrationFailure to false when the field is missing', () => {
    const wrapper = mountConfig(undefined, true);

    expect(savedValue(wrapper).shutdownVMOnMigrationFailure).toBe(false);
    expect(wrapper.findComponent('[name="shutdownVMOnMigrationFailure"]').exists()).toBe(true);
  });

  it('should keep an enabled shutdownVMOnMigrationFailure', () => {
    const wrapper = mountConfig({ shutdownVMOnMigrationFailure: true }, true);

    expect(savedValue(wrapper).shutdownVMOnMigrationFailure).toBe(true);
  });

  it('should save the selected value', () => {
    const wrapper = mountConfig(undefined, true);

    wrapper.vm.parseDefaultValue.shutdownVMOnMigrationFailure = true;
    wrapper.vm.update();

    expect(savedValue(wrapper).shutdownVMOnMigrationFailure).toBe(true);
  });

  it('should hide the control and not add the field on clusters without the feature', () => {
    const wrapper = mountConfig(undefined, false);

    expect(savedValue(wrapper)).not.toHaveProperty('shutdownVMOnMigrationFailure');
    expect(wrapper.findComponent('[name="shutdownVMOnMigrationFailure"]').exists()).toBe(false);
  });

  it('should keep a field set outside the UI on clusters without the feature', () => {
    const wrapper = mountConfig({ shutdownVMOnMigrationFailure: true }, false);

    expect(savedValue(wrapper).shutdownVMOnMigrationFailure).toBe(true);
  });
});
