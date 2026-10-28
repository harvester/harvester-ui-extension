import { mount } from '@vue/test-utils';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import { Banner } from '@components/Banner';
import VMPerformanceOptions from '../VMPerformanceOptions.vue';

const AUTO_ENABLED_TIP = 'harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.autoEnabledTip';
const NO_VIRTIO_TIP = 'harvester.virtualMachine.volume.diskPerformance.blockMultiQueue.noVirtioTip';

function mountOptions(props = {}, { featureEnabled = true } = {}) {
  return mount(VMPerformanceOptions, {
    props:  { mode: _CREATE, ...props },
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
    },
  });
}

function bannerFor(wrapper, labelKey) {
  return wrapper.findAllComponents(Banner).find((b) => b.props('labelKey') === labelKey);
}

describe('component: VMPerformanceOptions', () => {
  it('should be hidden when the highPerformanceStorage feature is disabled', () => {
    const wrapper = mountOptions({}, { featureEnabled: false });

    expect(wrapper.find('.vm-perf').exists()).toBe(false);
  });

  it('should show the section with its title and fields, without a toggle', () => {
    const wrapper = mountOptions();

    expect(wrapper.find('h3').text()).toBe('harvester.virtualMachine.volume.diskPerformance.title');
    expect(wrapper.find('.expand-toggle').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-vm-block-multi-queue"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-vm-iothreads-policy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-vm-iothread-count"]').exists()).toBe(false);
  });

  it('should only accept whole numbers as the supplemental pool thread count', () => {
    const wrapper = mountOptions({ ioThreadsPolicy: 'supplementalPool', ioThreadCount: 4 });
    const input = wrapper.find('[data-testid="input-vm-iothread-count"] input');

    expect(input.attributes('inputmode')).toBe('numeric');
  });

  it.each([
    [{}, false],
    [{ blockMultiQueue: true }, true],
    [{ ioThreadsPolicy: 'auto' }, true],
  ])('in view mode with %p, should show the section: %p', (props, shown) => {
    const wrapper = mountOptions({ ...props, mode: _VIEW });

    expect(wrapper.find('.vm-perf').exists()).toBe(shown);
  });

  it('should clear Block Multi-Queue when the last virtio disk goes away', async() => {
    const wrapper = mountOptions({ blockMultiQueue: true, hasVirtioDisk: true });

    await wrapper.setProps({ hasVirtioDisk: false });

    expect(wrapper.emitted('update:blockMultiQueue')).toStrictEqual([[false]]);
  });

  it('should pass the I/O threads policy hint as a label key so its quotes are not double-escaped', () => {
    const wrapper = mountOptions({ hasDedicatedIothread: true });
    const banner = bannerFor(wrapper, AUTO_ENABLED_TIP);

    expect(banner).toBeDefined();
    expect(banner.props('label')).toBeFalsy();
  });

  it('should not show the I/O threads policy hint when a policy is set', () => {
    const wrapper = mountOptions({ hasDedicatedIothread: true, ioThreadsPolicy: 'shared' });

    expect(bannerFor(wrapper, AUTO_ENABLED_TIP)).toBeUndefined();
  });

  it('should pass the no virtio disk hint as a label key', () => {
    const wrapper = mountOptions({ hasVirtioDisk: false });
    const banner = bannerFor(wrapper, NO_VIRTIO_TIP);

    expect(banner).toBeDefined();
    expect(banner.props('label')).toBeFalsy();
  });
});
