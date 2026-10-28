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

const nativeTip = (wrapper) => wrapper.findAllComponents(Banner)
  .find((b) => b.props('labelKey') === 'harvester.virtualMachine.volume.performance.ioMode.nativeRequiresNoCacheTip');

describe('component: DiskPerformanceOptions', () => {
  it('is hidden when the highPerformanceStorage feature is disabled', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk(), { featureEnabled: false }));

    expect(wrapper.find('.disk-performance').exists()).toBe(false);
  });

  it('renders for a hard disk when the feature is enabled', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk()));

    expect(wrapper.find('.disk-performance').exists()).toBe(true);
  });

  it('shows the profile without a toggle, and the individual fields only for Custom', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk()));

    expect(wrapper.find('.expand-toggle').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-disk-perf-profile"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-disk-cache"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-disk-dedicated-iothread"]').exists()).toBe(false);
  });

  it('shows the individual fields for a disk with custom options', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk({ cache: 'writeback', io: 'threads' })));

    expect(wrapper.find('[data-testid="input-disk-cache"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-disk-io"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-disk-dedicated-iothread"]').exists()).toBe(true);
  });

  it('is hidden for a CD-ROM', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk({ type: 'cd-rom' })));

    expect(wrapper.find('.disk-performance').exists()).toBe(false);
  });

  it('names the bus in the bus tip once the disk uses an option', () => {
    const plain = mount(DiskPerformanceOptions, mountOptions(hardDisk({ bus: 'sata' })));
    const tuned = mount(DiskPerformanceOptions, mountOptions(hardDisk({ bus: 'sata', cache: 'writeback' })));

    expect(plain.find('[data-testid="disk-perf-bus-tip"]').exists()).toBe(false);
    expect(tuned.find('[data-testid="disk-perf-bus-tip"]').exists()).toBe(true);
  });

  it('shows the Native I/O tip inside a live region that is there before Native I/O is picked', async() => {
    const value = hardDisk({ cache: 'writeback', io: 'threads' });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));
    const status = wrapper.find('[data-testid="disk-perf-native-status"]');

    expect(status.attributes('role')).toBe('status');
    expect(nativeTip(wrapper)).toBeUndefined();

    wrapper.vm.onIoChange('native');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="disk-perf-native-status"]').element).toBe(status.element);
    expect(status.element.contains(nativeTip(wrapper)?.element)).toBe(true);
  });

  it('keeps the live region and the Native I/O tip when picking Native I/O switches Custom to High Performance', async() => {
    const value = hardDisk({
      cache: 'writeback', io: 'threads', dedicatedIOThread: true
    });
    const wrapper = mount(DiskPerformanceOptions, mountOptions(value));
    const status = wrapper.find('[data-testid="disk-perf-native-status"]');

    expect(wrapper.vm.profile).toBe('custom');

    wrapper.vm.onIoChange('native');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.profile).toBe('highPerformance');
    expect(wrapper.find('[data-testid="input-disk-cache"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="disk-perf-native-status"]').element).toBe(status.element);
    expect(status.element.contains(nativeTip(wrapper)?.element)).toBe(true);
  });

  it('passes the Filesystem warning as a label key so its quotes are not double-escaped', () => {
    const wrapper = mount(DiskPerformanceOptions, mountOptions(hardDisk({ cache: 'none', volumeMode: 'Filesystem' })));
    const banner = wrapper.findAllComponents(Banner)
      .find((b) => b.props('labelKey') === 'harvester.virtualMachine.volume.performance.cacheMode.filesystemWarning');

    expect(banner).toBeDefined();
    expect(banner?.props('label')).toBeFalsy();
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
    const banner = nativeTip(wrapper);

    expect(banner).toBeDefined();
    expect(banner?.props('label')).toBeFalsy();
  });
});
