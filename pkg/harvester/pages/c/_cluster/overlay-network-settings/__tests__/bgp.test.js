import { shallowMount } from '@vue/test-utils';
import OverlayNetworkBgp from '../bgp.vue';

// What Harvester installs before anyone sets up BGP
const PLACEHOLDER_BGP = {
  neighborV4Address: '192.0.2.1',
  neighborV6Address: '2001:db8::1',
  neighborAS:        64512,
  clusterAS:         64513,
};

const CONFIGURED_BGP = {
  nodeNames:         'node-1',
  neighborV4Address: '10.115.53.2',
  neighborV6Address: '2001:db8::1',
  neighborAS:        65030,
  clusterAS:         65000,
};

function createConfiguration(bgp = PLACEHOLDER_BGP) {
  return {
    canUpdate: true,
    spec:      { enableBGP: true, bgp: { ...bgp } },
    save:      jest.fn().mockResolvedValue({}),
  };
}

// latest: what the API returns at save time, when it differs from the copy loaded with the page
function mountPage({
  featureEnabled = true, addonEnabled = true, configuration = createConfiguration(), latest = null
} = {}) {
  const dispatch = jest.fn((action, payload) => {
    if (action === 'harvester/find') {
      return Promise.resolve(latest || configuration);
    }

    if (action === 'harvester/clone') {
      return Promise.resolve(payload.resource);
    }

    if (action === 'harvester/findAll' && payload.type === 'harvesterhci.io.addon') {
      return Promise.resolve([{ name: 'kubeovn-operator', spec: { enabled: addonEnabled } }]);
    }

    return Promise.resolve([]);
  });
  const router = { push: jest.fn() };

  const wrapper = shallowMount(OverlayNetworkBgp, {
    data:   () => ({ addonEnabled, configuration }),
    global: {
      stubs: { 'router-link': true },
      mocks: {
        $fetchState: { pending: false },
        $router:     router,
        t:           (key, args) => (args ? `${ key } ${ JSON.stringify(args) }` : key),
        $store:      {
          dispatch,
          getters: {
            currentProduct:                         { inStore: 'harvester' },
            'harvester/all':                        () => [],
            'harvester-common/getFeatureEnabled': () => featureEnabled,
          },
        },
      },
    },
  });

  if (configuration) {
    wrapper.vm.loadBgp(configuration.spec.bgp);
  }

  return {
    wrapper, configuration, dispatch, router
  };
}

// A valid, enabled form; each case overrides what it checks
function fill(wrapper, values) {
  wrapper.setData({
    bgpEnabled: true,
    nodeNames:  ['node-1'],
    neighbors:  ['10.115.53.2'],
    neighborAS: '65030',
    clusterAS:  '65000',
    routerID:   '',
    nextHopV4:  '',
    nextHopV6:  '',
    ...values,
  });
}

describe('page: Overlay Network Settings > BGP Speaker', () => {
  it('should load an untouched install as disabled, without the placeholder values', async() => {
    const { wrapper, dispatch } = mountPage();

    await OverlayNetworkBgp.fetch.call(wrapper.vm);

    expect(dispatch).toHaveBeenCalledWith('harvester/find', { type: 'kubeovn.io.configuration', id: 'kube-system/kubeovn' });
    expect(wrapper.vm.formState()).toStrictEqual({
      enabled:    false,
      nodeNames:  [],
      neighbors:  [],
      neighborAS: '',
      clusterAS:  '',
      routerID:   '',
      nextHopV4:  '',
      nextHopV6:  '',
    });
  });

  it('should load a configured speaker, with both neighbor families in one list', () => {
    const configuration = createConfiguration({
      ...CONFIGURED_BGP, nodeNames: 'node-1,node-2', neighborV6Address: '2001:db8::2', nextHops: '10.115.48.1,2001:db8::9'
    });
    const { wrapper } = mountPage({ configuration });

    expect(wrapper.vm.formState()).toStrictEqual({
      enabled:    true,
      nodeNames:  ['node-1', 'node-2'],
      neighbors:  ['10.115.53.2', '2001:db8::2'],
      neighborAS: '65030',
      clusterAS:  '65000',
      routerID:   '',
      nextHopV4:  '10.115.48.1',
      nextHopV6:  '2001:db8::9',
    });
  });

  it('should not load the configuration when the add-on is disabled', async() => {
    const { wrapper, dispatch } = mountPage({ addonEnabled: false, configuration: null });

    await OverlayNetworkBgp.fetch.call(wrapper.vm);

    expect(wrapper.vm.addonEnabled).toBe(false);
    expect(dispatch).not.toHaveBeenCalledWith('harvester/find', expect.anything());
  });

  it('should split the neighbors by family, drop duplicates, keep the rest of the configuration and go back', async() => {
    const { wrapper, configuration, router } = mountPage();
    const buttonCb = jest.fn();

    fill(wrapper, {
      nodeNames: ['node-1', 'node-2'],
      neighbors: [' 10.115.53.2 ', '2001:db8::2', '10.115.53.3', '10.115.53.2', ''],
      nextHopV4: '10.115.48.1',
      nextHopV6: '2001:db8::9',
    });

    await wrapper.vm.save(buttonCb);

    expect(buttonCb).toHaveBeenCalledWith(true);
    expect(configuration.save).toHaveBeenCalledTimes(1);
    expect(configuration.spec).toStrictEqual({
      enableBGP: true,
      bgp:       {
        nodeNames:         'node-1,node-2',
        neighborV4Address: '10.115.53.2,10.115.53.3',
        neighborV6Address: '2001:db8::2',
        neighborAS:        65030,
        clusterAS:         65000,
        nextHops:          '10.115.48.1,2001:db8::9',
      },
    });
    expect(router.push).toHaveBeenCalledWith({ name: 'harvester-c-cluster-overlay-network-settings' });
  });

  it('should save on top of the latest copy of the configuration', async() => {
    // the operator updated the Configuration after the page loaded it
    const latest = createConfiguration();

    latest.spec = {
      enableBGP: false, ovnCentral: { replicas: 3 }, bgp: { ...PLACEHOLDER_BGP }
    };
    const { wrapper, configuration, dispatch } = mountPage({ latest });

    fill(wrapper);

    await wrapper.vm.save(jest.fn());

    expect(dispatch).toHaveBeenCalledWith('harvester/find', {
      type: 'kubeovn.io.configuration', id: 'kube-system/kubeovn', opt: { force: true }
    });
    expect(configuration.save).not.toHaveBeenCalled();
    expect(latest.save).toHaveBeenCalledTimes(1);
    expect(latest.spec).toStrictEqual({
      enableBGP:  false,
      ovnCentral: { replicas: 3 },
      bgp:        {
        nodeNames: 'node-1', neighborV4Address: '10.115.53.2', neighborAS: 65030, clusterAS: 65000
      },
    });
  });

  it('should only remove the speaker hosts when BGP is disabled', async() => {
    const { wrapper, configuration } = mountPage({ configuration: createConfiguration(CONFIGURED_BGP) });

    // invalid values are ignored while disabled
    fill(wrapper, { bgpEnabled: false, neighborAS: '' });

    expect(wrapper.vm.validationPassed).toBe(true);
    await wrapper.vm.save(jest.fn());

    const { nodeNames, ...rest } = CONFIGURED_BGP;

    expect(configuration.spec.bgp).toStrictEqual(rest);
  });

  it.each([
    ['an untouched install', PLACEHOLDER_BGP],
    ['a configured speaker', CONFIGURED_BGP],
  ])('should not save the configuration when nothing changed on %s, and go back', async(_, bgp) => {
    const { wrapper, configuration, router } = mountPage({ configuration: createConfiguration(bgp) });
    const buttonCb = jest.fn();

    await wrapper.vm.save(buttonCb);

    expect(configuration.save).not.toHaveBeenCalled();
    expect(buttonCb).toHaveBeenCalledWith(true);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('should report a failed save as plain messages and stay on the page', async() => {
    const { wrapper, configuration, router } = mountPage();
    const buttonCb = jest.fn();

    configuration.save.mockRejectedValue({ status: 409, message: 'the object has been modified' });
    fill(wrapper);

    await wrapper.vm.save(buttonCb);

    expect(buttonCb).toHaveBeenCalledWith(false);
    expect(wrapper.vm.errors).toStrictEqual(['the object has been modified']);
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    ['no speaker hosts', { nodeNames: [] }, 'harvester.bgp.validation.hostsRequired'],
    ['no neighbor', { neighbors: ['', ' '] }, 'harvester.bgp.validation.neighborRequired'],
    ['an invalid neighbor', { neighbors: ['10.115.53.300'] }, 'harvester.bgp.validation.neighborAddress'],
    ['an empty AS number', { neighborAS: '' }, 'harvester.bgp.validation.asNumber'],
    ['an AS number out of range', { clusterAS: '4294967295' }, 'harvester.bgp.validation.asNumber'],
    ['a router ID that is not IPv4', { routerID: '2001:db8::1' }, 'harvester.bgp.validation.routerID'],
    ['a router ID shared by two hosts', { nodeNames: ['node-1', 'node-2'], routerID: '10.115.48.1' }, 'harvester.bgp.validation.routerIDMultipleHosts'],
    ['an IPv6 address as the IPv4 next hop', { nextHopV4: '2001:db8::9' }, 'harvester.bgp.validation.ipv4'],
    ['an IPv4 address as the IPv6 next hop', { nextHopV6: '10.115.48.1' }, 'harvester.bgp.validation.ipv6'],
  ])('should disable Save and not save %s', async(_, values, errorKey) => {
    const { wrapper, configuration } = mountPage();
    const buttonCb = jest.fn();

    fill(wrapper, values);

    expect(wrapper.vm.validationPassed).toBe(false);

    await wrapper.vm.save(buttonCb);

    expect(buttonCb).toHaveBeenCalledWith(false);
    expect(wrapper.vm.errors).toStrictEqual([expect.stringContaining(errorKey)]);
    expect(configuration.save).not.toHaveBeenCalled();
  });

  it('should flag a router ID inline as soon as a second host is picked', async() => {
    const { wrapper } = mountPage();
    const [rule] = wrapper.vm.routerIDRules;

    fill(wrapper, { routerID: '10.115.48.1' });
    expect(rule('10.115.48.1')).toBeUndefined();

    await wrapper.setData({ nodeNames: ['node-1', 'node-2'] });
    expect(rule('10.115.48.1')).toContain('harvester.bgp.validation.routerIDMultipleHosts');
  });
});
