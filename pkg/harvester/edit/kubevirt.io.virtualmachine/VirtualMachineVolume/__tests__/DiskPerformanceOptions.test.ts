import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
import DiskPerformanceOptions from '../DiskPerformanceOptions.vue';

const mountOptions = (value, { featureEnabled = true } = {}) => ({
  propsData: { value, mode: _EDIT },
  mocks:     {
    $store: {
      getters: {
        'harvester-common/getFeatureEnabled': () => featureEnabled,
        'i18n/t':                             (key) => key,
        'i18n/exists':                        () => true,
      }
    },
  }
});

const hardDisk = (overrides = {}) => ({
  type: 'disk', bus: 'virtio', cache: '', io: '', dedicatedIOThread: false, ...overrides
});

describe('component: DiskPerformanceOptions', () => {
  it('is hidden when the highPerformanceStorage feature is disabled', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk(), { featureEnabled: false }));

    expect(wrapper.find('.disk-performance').exists()).toBe(false);
  });

  it('renders for a hard disk when the feature is enabled', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk()));

    expect(wrapper.find('.disk-performance').exists()).toBe(true);
  });

  it('applies the High Performance preset and emits update', () => {
    const value = hardDisk();
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onProfileChange('highPerformance');

    expect(value.cache).toBe('none');
    expect(value.io).toBe('native');
    expect(value.dedicatedIOThread).toBe(true);
    expect(value.bus).toBe('virtio');
    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it('clears all overrides when switching back to Default', () => {
    const value = hardDisk({
      cache: 'none', io: 'native', dedicatedIOThread: true
    });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onProfileChange('default');

    expect(value.cache).toBe('');
    expect(value.io).toBe('');
    expect(value.dedicatedIOThread).toBe(false);
    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it.each([
    ['a cached state', 'writeback'],
    ['the Default cache', ''],
  ])('forces cache to none when Native I/O is selected from %s', (_label, cache) => {
    const value = hardDisk({ cache });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onIoChange('native');

    expect(value.io).toBe('native');
    expect(value.cache).toBe('none');
    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it('disables every cache option except none while Native I/O is active', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk({ io: 'native' })));

    const disabledByValue = wrapper.vm.cacheOptions.reduce((acc, opt) => {
      acc[opt.value] = opt.disabled;

      return acc;
    }, {});

    expect(disabledByValue['none']).toBe(false);
    expect(disabledByValue['']).toBe(true);
    expect(disabledByValue['writeback']).toBe(true);
    expect(disabledByValue['writethrough']).toBe(true);
  });
});
