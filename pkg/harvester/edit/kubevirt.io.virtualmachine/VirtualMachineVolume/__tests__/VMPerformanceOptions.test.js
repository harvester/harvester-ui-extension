import { mount } from '@vue/test-utils';
import { _CREATE } from '@shell/config/query-params';
import { Banner } from '@components/Banner';
import VMPerformanceOptions from '../VMPerformanceOptions.vue';

const AUTO_ENABLED_TIP = 'harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.autoEnabledTip';
const NO_VIRTIO_TIP = 'harvester.virtualMachine.volume.diskPerformance.blockMultiQueue.noVirtioTip';

function mountOptions(props = {}) {
  return mount(VMPerformanceOptions, {
    props:  { mode: _CREATE, ...props },
    global: {
      mocks: {
        $store: {
          getters: {
            'harvester-common/getFeatureEnabled': () => true,
            'i18n/t':                             (key) => key,
            'i18n/exists':                        () => true,
          }
        },
        t: (key) => key,
      },
    },
  });
}

async function expand(wrapper) {
  await wrapper.find('.expand-toggle').trigger('click');
}

function bannerFor(wrapper, labelKey) {
  return wrapper.findAllComponents(Banner).find((b) => b.props('labelKey') === labelKey);
}

describe('component: VMPerformanceOptions', () => {
  it('should pass the I/O threads policy hint as a label key so its quotes are not double-escaped', async() => {
    const wrapper = mountOptions({ hasDedicatedIothread: true });

    await expand(wrapper);
    const banner = bannerFor(wrapper, AUTO_ENABLED_TIP);

    expect(banner).toBeDefined();
    expect(banner.props('label')).toBeFalsy();
  });

  it('should not show the I/O threads policy hint when a policy is set', async() => {
    const wrapper = mountOptions({ hasDedicatedIothread: true, ioThreadsPolicy: 'shared' });

    expect(bannerFor(wrapper, AUTO_ENABLED_TIP)).toBeUndefined();
  });

  it('should pass the no virtio disk hint as a label key', async() => {
    const wrapper = mountOptions({ hasVirtioDisk: false });

    await expand(wrapper);
    const banner = bannerFor(wrapper, NO_VIRTIO_TIP);

    expect(banner).toBeDefined();
    expect(banner.props('label')).toBeFalsy();
  });
});
