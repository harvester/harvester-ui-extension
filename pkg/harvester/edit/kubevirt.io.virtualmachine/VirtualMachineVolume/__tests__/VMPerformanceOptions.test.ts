import { mount } from '@vue/test-utils';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import VMPerformanceOptions from '../VMPerformanceOptions.vue';

const mountOptions = (props = {}, { featureEnabled = true } = {}) => ({
  props:  { mode: _EDIT, ...props },
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

describe('component: VMPerformanceOptions', () => {
  it('is hidden when the highPerformanceStorage feature is disabled', () => {
    const wrapper = mount(VMPerformanceOptions, mountOptions({}, { featureEnabled: false }));

    expect(wrapper.find('.vm-perf').exists()).toBe(false);
  });

  it('shows the section with its title and fields, without a toggle', () => {
    const wrapper = mount(VMPerformanceOptions, mountOptions());

    expect(wrapper.find('h3').text()).toBe('harvester.virtualMachine.volume.diskPerformance.title');
    expect(wrapper.find('.expand-toggle').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-vm-block-multi-queue"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-vm-iothreads-policy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-vm-iothread-count"]').exists()).toBe(false);
  });

  it('only accepts whole numbers as the supplemental pool thread count', () => {
    const wrapper = mount(VMPerformanceOptions, mountOptions({ ioThreadsPolicy: 'supplementalPool', ioThreadCount: 4 }));
    const input = wrapper.find('[data-testid="input-vm-iothread-count"] input');

    expect(input.attributes('inputmode')).toBe('numeric');
  });

  it.each([
    [{}, false],
    [{ blockMultiQueue: true }, true],
    [{ ioThreadsPolicy: 'auto' }, true],
  ])('in view mode with %p, shows the section: %p', (props, shown) => {
    const wrapper = mount(VMPerformanceOptions, mountOptions({ ...props, mode: _VIEW }));

    expect(wrapper.find('.vm-perf').exists()).toBe(shown);
  });

  it('clears Block Multi-Queue when the last virtio disk goes away', async() => {
    const wrapper = mount(VMPerformanceOptions, mountOptions({ blockMultiQueue: true, hasVirtioDisk: true }));

    await wrapper.setProps({ hasVirtioDisk: false });

    expect(wrapper.emitted('update:blockMultiQueue')).toStrictEqual([[false]]);
  });
});
