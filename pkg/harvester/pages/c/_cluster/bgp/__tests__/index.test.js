import { shallowMount } from '@vue/test-utils';
import { Banner } from '@components/Banner';
import HarvesterBgp from '../index.vue';

const PLACEHOLDER_BGP = {
  neighborV4Address: '192.0.2.1',
  neighborV6Address: '2001:db8::1',
  neighborAS:        64512,
  clusterAS:         64513,
};

function createConfiguration(bgp = PLACEHOLDER_BGP) {
  return {
    canUpdate: true,
    spec:      { enableBGP: true, bgp: { ...bgp } },
    save:      jest.fn().mockResolvedValue({}),
  };
}

function mountPage({ featureEnabled = true, addonEnabled = true, configuration = createConfiguration() } = {}) {
  const dispatch = jest.fn((action) => {
    if (action === 'harvester/find' || action === 'harvester/clone') {
      return Promise.resolve(configuration);
    }

    return Promise.resolve([]);
  });

  const wrapper = shallowMount(HarvesterBgp, {
    data:   () => ({ addonEnabled, configuration: featureEnabled && addonEnabled ? configuration : null }),
    global: {
      mocks: {
        $fetchState: { pending: false },
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

  return { wrapper, configuration };
}

function fill(wrapper, values) {
  wrapper.setData({
    nodeNames:         [],
    neighborV4Address: '',
    neighborV6Address: '',
    neighborAS:        '65030',
    clusterAS:         '65000',
    routerID:          '',
    nextHops:          '',
    ...values,
  });
}

describe('page: BGP', () => {
  it('should save the form into spec.bgp and keep the rest of the configuration', async() => {
    const { wrapper, configuration } = mountPage();
    const buttonCb = jest.fn();

    fill(wrapper, {
      nodeNames:         ['node-1', 'node-2'],
      neighborV4Address: ' 10.115.53.2, 10.115.53.3 ',
      neighborV6Address: '',
      routerID:          '10.115.48.1',
      nextHops:          '10.115.48.1,2001:db8::1',
    });

    await wrapper.vm.save(buttonCb);

    expect(configuration.save).toHaveBeenCalledTimes(1);
    expect(buttonCb).toHaveBeenCalledWith(true);
    expect(configuration.spec).toStrictEqual({
      enableBGP: true,
      bgp:       {
        nodeNames:         'node-1,node-2',
        neighborV4Address: '10.115.53.2,10.115.53.3',
        neighborAS:        65030,
        clusterAS:         65000,
        routerID:          '10.115.48.1',
        nextHops:          '10.115.48.1,2001:db8::1',
      },
    });
  });

  it('should load the stored values into the form', async() => {
    const configuration = createConfiguration({ ...PLACEHOLDER_BGP, nodeNames: 'node-1,node-2' });
    const { wrapper } = mountPage({ configuration });

    await wrapper.vm.loadConfiguration();

    expect(wrapper.vm.nodeNames).toStrictEqual(['node-1', 'node-2']);
    expect(wrapper.vm.neighborV4Address).toBe('192.0.2.1');
    expect(wrapper.vm.neighborV6Address).toBe('2001:db8::1');
    expect(wrapper.vm.neighborAS).toBe(64512);
    expect(wrapper.vm.clusterAS).toBe(64513);
  });

  it.each([
    ['speaker hosts without a neighbor', { nodeNames: ['node-1'], neighborV4Address: '' }, 'harvester.bgp.validation.neighborRequired'],
    ['an invalid IPv4 neighbor', { neighborV4Address: '10.115.53.2,2001:db8::2' }, 'harvester.bgp.validation.ipv4List'],
    ['an invalid IPv6 neighbor', { neighborV6Address: '10.115.53.2' }, 'harvester.bgp.validation.ipv6List'],
    ['an empty AS number', { neighborAS: '' }, 'harvester.bgp.validation.asNumber'],
    ['an AS number out of range', { clusterAS: '4294967295' }, 'harvester.bgp.validation.asNumber'],
    ['a router ID that is not IPv4', { routerID: '2001:db8::1' }, 'harvester.bgp.validation.routerID'],
    ['two IPv4 next hops', { nextHops: '10.115.48.1,10.115.48.2' }, 'harvester.bgp.validation.nextHops'],
  ])('should not save %s', async(_, values, errorKey) => {
    const { wrapper, configuration } = mountPage();
    const buttonCb = jest.fn();

    fill(wrapper, { neighborV4Address: '10.115.53.2', ...values });

    await wrapper.vm.save(buttonCb);

    expect(configuration.save).not.toHaveBeenCalled();
    expect(buttonCb).toHaveBeenCalledWith(false);
    expect(wrapper.vm.errors).toHaveLength(1);
    expect(wrapper.vm.errors[0]).toContain(errorKey);
  });

  it('should only show a warning on Harvester versions without BGP support', () => {
    const { wrapper } = mountPage({ featureEnabled: false });
    const banners = wrapper.findAllComponents(Banner);

    expect(banners).toHaveLength(1);
    expect(banners[0].props('label')).toBe('harvester.bgp.unsupported');
    expect(wrapper.find('[data-testid="bgp-save"]').exists()).toBe(false);
  });
});
