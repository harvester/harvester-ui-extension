import { shallowMount } from '@vue/test-utils';
import OverlayNetworkSettings from '../index.vue';
import KubeOvnConfiguration from '../../../../../models/kubeovn.io.configuration';

// A real model, so the card reads the same getters as in the app
function createConfiguration(bgp) {
  const configuration = Object.create(KubeOvnConfiguration.prototype);

  Object.defineProperty(configuration, 'spec', { value: { bgp }, configurable: true });
  Object.defineProperty(configuration, 'canUpdate', { value: true, configurable: true });

  return configuration;
}

function mountPage({ featureEnabled = true, addonEnabled = true, configuration = null } = {}) {
  const router = { push: jest.fn() };
  const wrapper = shallowMount(OverlayNetworkSettings, {
    data:   () => ({ addonEnabled, configuration }),
    global: {
      mocks: {
        $fetchState: { pending: false },
        $router:     router,
        t:           (key, args) => (args ? `${ key } ${ JSON.stringify(args) }` : key),
        $store:      { getters: { 'harvester-common/getFeatureEnabled': () => featureEnabled } },
      },
    },
  });

  return { wrapper, router };
}

describe('page: Overlay Network Settings', () => {
  it('should show the BGP speaker as disabled when no host runs it', () => {
    const configuration = createConfiguration({
      neighborV4Address: '192.0.2.1', neighborV6Address: '2001:db8::1', neighborAS: 64512, clusterAS: 64513
    });
    const { wrapper } = mountPage({ configuration });

    expect(wrapper.vm.bgpSummary).toStrictEqual([]);
    expect(wrapper.find('[data-testid="overlay-setting-bgp"] pre').text()).toBe('generic.disabled');
  });

  it('should summarize a configured BGP speaker, without the placeholder neighbor', () => {
    const configuration = createConfiguration({
      nodeNames:         'node-1,node-2',
      neighborV4Address: '10.115.53.2',
      neighborV6Address: '2001:db8::1',
      neighborAS:        65030,
      clusterAS:         65000,
      nextHops:          '10.115.48.1',
    });
    const { wrapper } = mountPage({ configuration });

    expect(wrapper.vm.bgpSummary).toStrictEqual([
      'harvester.bgp.summary.hosts {"hosts":"node-1, node-2"}',
      'harvester.bgp.summary.clusterAS {"as":65000}',
      'harvester.bgp.summary.neighbors {"neighbors":"10.115.53.2","as":65030}',
      'harvester.bgp.summary.nextHops {"hops":"10.115.48.1"}',
    ]);
  });

  it('should say the state is unknown, not disabled, when the configuration could not be read', () => {
    const { wrapper } = mountPage({ configuration: null });

    expect(wrapper.find('[data-testid="overlay-setting-bgp"] pre').text()).toBe('generic.unknown');
    expect(wrapper.find('[data-testid="bgp-action-button"]').exists()).toBe(false);
  });

  it('should say the BGP speaker needs v1.10.0 on older Harvester versions', () => {
    const { wrapper } = mountPage({ featureEnabled: false });

    expect(wrapper.find('[data-testid="overlay-setting-bgp"] pre').text()).toBe('harvester.bgp.unsupported');
    expect(wrapper.find('[data-testid="bgp-action-button"]').exists()).toBe(false);
  });

  it('should only point to the add-on when it is disabled', () => {
    const { wrapper } = mountPage({ addonEnabled: false });

    expect(wrapper.find('[data-testid="overlay-setting-bgp"]').exists()).toBe(false);
  });

  it('should open the BGP speaker page from the card menu', () => {
    const { wrapper, router } = mountPage({ configuration: createConfiguration({}) });

    wrapper.vm.editBgp();

    expect(router.push).toHaveBeenCalledWith({ name: 'harvester-c-cluster-overlay-network-settings-bgp' });
  });
});
