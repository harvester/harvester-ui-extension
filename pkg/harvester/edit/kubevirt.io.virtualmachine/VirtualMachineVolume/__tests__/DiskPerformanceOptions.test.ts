import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { _EDIT } from '@shell/config/query-params';
import { Banner } from '@components/Banner';
import DiskPerformanceOptions from '../DiskPerformanceOptions.vue';

const mountOptions = (value, { featureEnabled = true } = {}) => ({
  props:  { value, mode: _EDIT },
  global: {
    mocks: {
      $store: {
        getters: {
          'harvester-common/getFeatureEnabled': () => featureEnabled,
          'i18n/t':                             (key) => key,
          'i18n/exists':                        () => true,
        }
      },
      t: (key) => key,
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

  it('restores the original bus when leaving High Performance for Default', () => {
    const value = hardDisk({ bus: 'sata' });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onProfileChange('highPerformance');
    expect(value.bus).toBe('virtio');

    wrapper.vm.onProfileChange('default');
    expect(value.bus).toBe('sata');
  });

  it('keeps a bus the user picked themselves after High Performance', () => {
    const value = hardDisk({ bus: 'sata' });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onProfileChange('highPerformance');
    value.bus = 'scsi';

    wrapper.vm.onProfileChange('default');
    expect(value.bus).toBe('scsi');
  });

  it('leaves the bus alone for a disk that never used the High Performance preset', () => {
    const value = hardDisk({
      bus: 'sata', cache: 'writeback', io: 'threads'
    });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onProfileChange('default');
    expect(value.bus).toBe('sata');
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

  it.each([
    ['Default', {
      cache: '', io: '', dedicatedIOThread: false
    }],
    ['High Performance', {
      cache: 'none', io: 'native', dedicatedIOThread: true
    }],
  ])('stays on Custom when the options match the %s preset', async(_label, opts) => {
    const value = hardDisk({ cache: 'writeback' });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));

    wrapper.vm.onProfileChange('custom');
    await wrapper.setProps({ value: { ...value, ...opts } });
    await nextTick();

    expect(wrapper.vm.profile).toBe('custom');
  });

  it('detects the profile from an existing disk', async() => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk()));

    expect(wrapper.vm.profile).toBe('default');

    await wrapper.setProps({
      value: hardDisk({
        cache: 'none', io: 'native', dedicatedIOThread: true
      })
    });

    expect(wrapper.vm.profile).toBe('highPerformance');
  });

  it('updates an automatically detected Custom profile when preset values are loaded', async() => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk({ cache: 'writeback' })));

    expect(wrapper.vm.profile).toBe('custom');

    await wrapper.setProps({
      value: hardDisk({
        cache: 'none', io: 'native', dedicatedIOThread: true
      })
    });

    expect(wrapper.vm.profile).toBe('highPerformance');
  });

  it('passes the Native I/O hint as a label key so its quotes are not double-escaped', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk({ io: 'native' })));
    const banner = wrapper.findAllComponents(Banner)
      .find((b) => b.props('labelKey') === 'harvester.virtualMachine.volume.performance.ioMode.nativeRequiresNoCacheTip');

    expect(banner).toBeDefined();
    expect(banner?.props('label')).toBeFalsy();
  });
});
