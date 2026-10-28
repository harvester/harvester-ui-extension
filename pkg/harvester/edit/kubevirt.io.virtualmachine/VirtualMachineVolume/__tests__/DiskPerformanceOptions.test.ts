import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
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
    expect(status.text()).toBe('');

    wrapper.vm.onIoChange('native');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="disk-perf-native-status"]').element).toBe(status.element);
    expect(status.text()).toContain('harvester.virtualMachine.volume.performance.ioMode.nativeRequiresNoCacheTip');
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
    expect(status.text()).toContain('harvester.virtualMachine.volume.performance.ioMode.nativeRequiresNoCacheTip');
  });

  it('passes unescaped text to the banners, so quotes in a tip are not escaped twice', () => {
    // Like the shell's t(): HTML-escaped unless raw is asked for. Banner escapes its label itself.
    const t = (key, args, raw) => (raw ? `"None" ${ key }` : `&quot;None&quot; ${ key }`);
    const options = mountOptions(hardDisk({
      cache: 'none', io: 'native', volumeMode: 'Filesystem'
    }));

    options.global.mocks.t = t;
    const labels = mount(DiskPerformanceOptions, options).findAllComponents({ name: 'Banner' }).map((b) => b.props('label'));

    expect(labels).toContain('"None" harvester.virtualMachine.volume.performance.cacheMode.filesystemWarning');
    expect(labels).toContain('"None" harvester.virtualMachine.volume.performance.ioMode.nativeRequiresNoCacheTip');
    expect(labels.some((l) => l.includes('&quot;'))).toBe(false);
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
});
