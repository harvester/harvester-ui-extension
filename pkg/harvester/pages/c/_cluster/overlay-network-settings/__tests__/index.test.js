import { shallowMount } from '@vue/test-utils';
import { Banner } from '@components/Banner';
import ArrayList from '@shell/components/form/ArrayList';
import CruResource from '@shell/components/CruResource';
import { RcSection } from '@components/RcSection';
import OverlayNetworkSettings from '../index.vue';
import KubeOvnConfiguration from '../../../../../models/kubeovn.io.configuration';

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

// A real model, so the page reads the same getters as in the app
function createConfiguration(bgp = PLACEHOLDER_BGP) {
  const configuration = Object.create(KubeOvnConfiguration.prototype);

  Object.defineProperty(configuration, 'spec', {
    value: { enableBGP: true, bgp: { ...bgp } }, writable: true, configurable: true
  });
  Object.defineProperty(configuration, 'canUpdate', { value: true, configurable: true });
  Object.defineProperty(configuration, 'save', { value: jest.fn().mockResolvedValue({}), configurable: true });

  return configuration;
}

// latest: what the API returns at save time, when it differs from the copy loaded with the page
// findError: the API refuses to return the Configuration
function mountPage({
  featureEnabled = true, addonEnabled = true, configuration = createConfiguration(), latest = null, findError = null
} = {}) {
  const dispatch = jest.fn((action, payload) => {
    if (action === 'harvester/find') {
      return findError ? Promise.reject(findError) : Promise.resolve(latest || configuration);
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

  const wrapper = shallowMount(OverlayNetworkSettings, {
    data:   () => ({ addonEnabled, configuration }),
    global: {
      // the section and the form are stubbed, but what they hold is rendered
      renderStubDefaultSlot: true,
      mocks:                 {
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
    wrapper.vm.loadBgp(configuration);
  }

  return {
    wrapper, configuration, dispatch, router
  };
}

// A valid, enabled form; each case overrides what it checks
function fill(wrapper, values) {
  wrapper.setData({
    bgpEnabled:  true,
    nodeNames:   ['node-1'],
    neighborsV4: ['10.115.53.2'],
    neighborsV6: [],
    neighborAS:  '65030',
    clusterAS:   '65000',
    routerID:    '',
    nextHopV4:   '',
    nextHopV6:   '',
    ...values,
  });
}

describe('page: Overlay Network Settings, BGP Speaker section', () => {
  it('should load an untouched install as disabled, without the placeholder values', async() => {
    const { wrapper, dispatch } = mountPage();

    await OverlayNetworkSettings.fetch.call(wrapper.vm);

    expect(dispatch).toHaveBeenCalledWith('harvester/find', { type: 'kubeovn.io.configuration', id: 'kube-system/kubeovn' });
    expect(wrapper.vm.formState()).toStrictEqual({
      enabled:     false,
      nodeNames:   [],
      neighborsV4: [],
      neighborsV6: [],
      neighborAS:  '',
      clusterAS:   '',
      routerID:    '',
      nextHopV4:   '',
      nextHopV6:   '',
    });
  });

  it('should keep the AS numbers of a disabled speaker, even when they are the ones Harvester installs', () => {
    // set up with the private AS numbers 64512/64513, then disabled: only the hosts are gone
    const configuration = createConfiguration({ ...PLACEHOLDER_BGP, neighborV4Address: '10.115.53.2' });
    const { wrapper } = mountPage({ configuration });

    expect(wrapper.vm.formState()).toStrictEqual({
      enabled:     false,
      nodeNames:   [],
      neighborsV4: ['10.115.53.2'],
      neighborsV6: [],
      neighborAS:  '64512',
      clusterAS:   '64513',
      routerID:    '',
      nextHopV4:   '',
      nextHopV6:   '',
    });
  });

  it('should load a configured speaker, with each neighbor family in its own list', () => {
    const configuration = createConfiguration({
      ...CONFIGURED_BGP, nodeNames: 'node-1,node-2', neighborV6Address: '2001:db8::2', nextHops: '10.115.48.1,2001:db8::9'
    });
    const { wrapper } = mountPage({ configuration });

    expect(wrapper.vm.formState()).toStrictEqual({
      enabled:     true,
      nodeNames:   ['node-1', 'node-2'],
      neighborsV4: ['10.115.53.2'],
      neighborsV6: ['2001:db8::2'],
      neighborAS:  '65030',
      clusterAS:   '65000',
      routerID:    '',
      nextHopV4:   '10.115.48.1',
      nextHopV6:   '2001:db8::9',
    });
  });

  it('should edit the BGP speaker in a section of this page, without a Cancel button', () => {
    const { wrapper } = mountPage();

    expect(wrapper.find('h1').text()).toBe('harvester.overlayNetworkSettings.title');
    expect(wrapper.findComponent(RcSection).props()).toStrictEqual(expect.objectContaining({
      title: 'harvester.bgp.label', type: 'primary', mode: 'with-header', expandable: false
    }));
    expect(wrapper.findComponent(CruResource).props('showCancel')).toBe(false);
  });

  it('should name the Enabled/Disabled choice and both neighbor lists for screen readers', async() => {
    const { wrapper } = mountPage({ configuration: createConfiguration(CONFIGURED_BGP) });

    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="bgp-enabled"]').attributes('aria-label')).toBe('harvester.bgp.label');
    expect(wrapper.findAllComponents(ArrayList).map((list) => list.props('a11yLabel'))).toStrictEqual([
      'harvester.bgp.neighborsV4.label',
      'harvester.bgp.neighborsV6.label',
    ]);
  });

  it('should group the neighbors and the advanced options in their own sections when the speaker is enabled', async() => {
    const { wrapper } = mountPage({ configuration: createConfiguration(CONFIGURED_BGP) });

    await wrapper.vm.$nextTick();

    expect(wrapper.findAllComponents(RcSection).map((section) => [section.props('title'), section.props('type')])).toStrictEqual([
      ['harvester.bgp.label', 'primary'],
      ['harvester.bgp.neighbors.label', 'secondary'],
      ['harvester.bgp.sections.advanced', 'secondary'],
    ]);
  });

  it('should say the BGP speaker needs v1.10.0 on older Harvester versions', () => {
    const { wrapper } = mountPage({ featureEnabled: false, configuration: null });

    expect(wrapper.findComponent(RcSection).props('title')).toBe('harvester.bgp.label');
    expect(wrapper.findAllComponents(Banner).map((b) => b.props('label'))).toStrictEqual(['harvester.bgp.unsupported']);
    expect(wrapper.findComponent(CruResource).exists()).toBe(false);
  });

  it('should only point to the add-on when it is disabled', () => {
    const { wrapper } = mountPage({ addonEnabled: false, configuration: null });
    const banners = wrapper.findAllComponents(Banner);

    expect(banners).toHaveLength(1);
    expect(banners[0].props('color')).toBe('warning');
    expect(wrapper.findComponent(CruResource).exists()).toBe(false);
  });

  it('should show why there is no form when the configuration cannot be read', async() => {
    const findError = Object.assign(new Error('configurations.kubeovn.io "kubeovn" is forbidden'), { status: 403 });
    const { wrapper } = mountPage({ configuration: null, findError });

    await OverlayNetworkSettings.fetch.call(wrapper.vm);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.configuration).toBeNull();
    expect(wrapper.findAllComponents(Banner).map((b) => b.props('label'))).toStrictEqual(['configurations.kubeovn.io "kubeovn" is forbidden']);
  });

  it('should link to the kubeovn-operator add-on by route name', () => {
    const { wrapper } = mountPage();

    expect(wrapper.vm.addonLocation).toStrictEqual({
      name:   'harvester-c-cluster-resource-namespace-id',
      params: {
        resource: 'harvesterhci.io.addon', namespace: 'kube-system', id: 'kubeovn-operator'
      },
      query: { mode: 'edit' },
    });
  });

  it('should not load the configuration when the add-on is disabled', async() => {
    const { wrapper, dispatch } = mountPage({ addonEnabled: false, configuration: null });

    await OverlayNetworkSettings.fetch.call(wrapper.vm);

    expect(wrapper.vm.addonEnabled).toBe(false);
    expect(dispatch).not.toHaveBeenCalledWith('harvester/find', expect.anything());
  });

  it('should save both neighbor lists without duplicates or empty rows, keep the rest of the configuration and stay on the page', async() => {
    const { wrapper, configuration, router } = mountPage();
    const buttonCb = jest.fn();

    fill(wrapper, {
      nodeNames:   ['node-1', 'node-2'],
      neighborsV4: [' 10.115.53.2 ', '10.115.53.3', '10.115.53.2', ''],
      neighborsV6: ['2001:db8::2', ''],
      nextHopV4:   '10.115.48.1',
      nextHopV6:   '2001:db8::9',
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
    expect(router.push).not.toHaveBeenCalled();
    // the form now shows what was saved, so saving again without a change writes nothing
    expect(wrapper.vm.formState()).toStrictEqual(expect.objectContaining({ neighborsV4: ['10.115.53.2', '10.115.53.3'], neighborsV6: ['2001:db8::2'] }));

    await wrapper.vm.save(buttonCb);

    expect(configuration.save).toHaveBeenCalledTimes(1);
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
  ])('should not save the configuration when nothing changed on %s', async(_, bgp) => {
    const { wrapper, configuration, router } = mountPage({ configuration: createConfiguration(bgp) });
    const buttonCb = jest.fn();

    await wrapper.vm.save(buttonCb);

    expect(configuration.save).not.toHaveBeenCalled();
    expect(buttonCb).toHaveBeenCalledWith(true);
    expect(router.push).not.toHaveBeenCalled();
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
    ['no neighbor', { neighborsV4: ['', ' '], neighborsV6: [''] }, 'harvester.bgp.validation.neighborRequired'],
    ['an invalid IPv4 neighbor', { neighborsV4: ['10.115.53.300'] }, 'harvester.bgp.validation.neighborV4'],
    ['an IPv6 address in the IPv4 neighbors', { neighborsV4: ['2001:db8::2'] }, 'harvester.bgp.validation.neighborV4'],
    ['an IPv4 address in the IPv6 neighbors', { neighborsV4: [], neighborsV6: ['10.115.53.2'] }, 'harvester.bgp.validation.neighborV6'],
    ['the IPv4 placeholder neighbor', { neighborsV4: ['192.0.2.1'] }, 'harvester.bgp.validation.placeholderNeighbor'],
    ['the IPv6 placeholder neighbor', { neighborsV6: ['2001:db8::1'] }, 'harvester.bgp.validation.placeholderNeighbor'],
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

  it('should flag missing speaker hosts and neighbors on the fields', async() => {
    const { wrapper } = mountPage();
    const [hostsRule] = wrapper.vm.nodeNamesRules;
    const [v4Rule] = wrapper.vm.neighborV4Rules;
    const [v6Rule] = wrapper.vm.neighborV6Rules;

    fill(wrapper, {
      nodeNames: [], neighborsV4: [''], neighborsV6: ['']
    });

    expect(hostsRule([])).toContain('harvester.bgp.validation.hostsRequired');
    expect(hostsRule(['node-1'])).toBeUndefined();
    // no neighbor yet: both lists say so
    expect(v4Rule('')).toContain('harvester.bgp.validation.neighborRequired');
    expect(v6Rule('')).toContain('harvester.bgp.validation.neighborRequired');

    await wrapper.setData({ neighborsV6: ['2001:db8::2'] });

    // one neighbor in either list is enough; an address of the wrong family is flagged
    expect(v4Rule('')).toBeUndefined();
    expect(v4Rule('2001:db8::2')).toContain('harvester.bgp.validation.neighborV4');
    expect(v6Rule('10.115.53.2')).toContain('harvester.bgp.validation.neighborV6');
    expect(v6Rule('2001:db8::1')).toContain('harvester.bgp.validation.placeholderNeighbor');
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
