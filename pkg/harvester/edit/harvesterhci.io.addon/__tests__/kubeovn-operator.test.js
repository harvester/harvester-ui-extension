import { reactive } from 'vue';
import { shallowMount } from '@vue/test-utils';
import EditAddonKubeovnOperator from '../kubeovn-operator.vue';

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

function mountAddon({
  enabled = true, featureEnabled = true, mode = 'edit', configuration = createConfiguration()
} = {}) {
  const dispatch = jest.fn((action) => {
    if (action === 'harvester/find' || action === 'harvester/clone') {
      return Promise.resolve(configuration);
    }

    return Promise.resolve([]);
  });
  const registerBeforeHook = jest.fn();

  const wrapper = shallowMount(EditAddonKubeovnOperator, {
    props: {
      // the real add-on is a reactive store model
      value: reactive({ spec: { enabled } }),
      mode,
      registerBeforeHook,
    },
    data:   () => ({ configuration }),
    global: {
      mocks: {
        t:      (key, args) => (args ? `${ key } ${ JSON.stringify(args) }` : key),
        $store: {
          dispatch,
          getters: {
            currentProduct:                         { inStore: 'harvester' },
            'harvester/all':                        () => [],
            'harvester/schemaFor':                  () => ({}),
            'harvester-common/getFeatureEnabled': () => featureEnabled,
          },
        },
      },
    },
  });

  return {
    wrapper, configuration, dispatch, registerBeforeHook
  };
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

describe('edit: kubeovn-operator add-on BGP', () => {
  it('should save the BGP tab before the add-on', () => {
    const { wrapper, registerBeforeHook } = mountAddon();

    expect(registerBeforeHook).toHaveBeenCalledWith(wrapper.vm.saveBgp, 'saveBgp');
  });

  it('should save the BGP tab into spec.bgp and keep the rest of the configuration', async() => {
    const { wrapper, configuration } = mountAddon();

    fill(wrapper, {
      nodeNames:         ['node-1', 'node-2'],
      neighborV4Address: ' 10.115.53.2, 10.115.53.3 ',
      neighborV6Address: '',
      routerID:          '10.115.48.1',
      nextHops:          '10.115.48.1,2001:db8::1',
    });

    await wrapper.vm.saveBgp();

    expect(configuration.save).toHaveBeenCalledTimes(1);
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

  it('should load the stored values into the BGP tab', async() => {
    const configuration = createConfiguration({ ...PLACEHOLDER_BGP, nodeNames: 'node-1,node-2' });
    const { wrapper, dispatch } = mountAddon({ configuration });

    await EditAddonKubeovnOperator.fetch.call(wrapper.vm);

    expect(dispatch).toHaveBeenCalledWith('harvester/find', { type: 'kubeovn.io.configuration', id: 'kube-system/kubeovn' });
    expect(wrapper.vm.nodeNames).toStrictEqual(['node-1', 'node-2']);
    expect(wrapper.vm.neighborV4Address).toBe('192.0.2.1');
    expect(wrapper.vm.neighborV6Address).toBe('2001:db8::1');
    expect(wrapper.vm.neighborAS).toBe(64512);
    expect(wrapper.vm.clusterAS).toBe(64513);
  });

  it('should not load BGP on Harvester versions without BGP support', async() => {
    const { wrapper, dispatch } = mountAddon({ featureEnabled: false, configuration: null });

    await EditAddonKubeovnOperator.fetch.call(wrapper.vm);

    expect(dispatch).not.toHaveBeenCalled();
    expect(wrapper.vm.showBgp).toBe(false);
  });

  it('should not save the configuration when nothing changed', async() => {
    const { wrapper, configuration } = mountAddon();

    wrapper.vm.loadBgp(configuration.spec.bgp);

    await wrapper.vm.saveBgp();

    expect(configuration.save).not.toHaveBeenCalled();
  });

  it('should leave BGP alone when the add-on is being disabled', async() => {
    const { wrapper, configuration } = mountAddon();

    fill(wrapper, { neighborAS: '' });
    wrapper.vm.value.spec.enabled = false;

    await expect(wrapper.vm.saveBgp()).resolves.toBeUndefined();
    expect(configuration.save).not.toHaveBeenCalled();
  });

  it('should report a failed configuration save as plain messages', async() => {
    const { wrapper, configuration } = mountAddon();

    configuration.save.mockRejectedValue({ status: 409, message: 'the object has been modified' });
    fill(wrapper, { neighborV4Address: '10.115.53.2' });

    await expect(wrapper.vm.saveBgp()).rejects.toStrictEqual(['the object has been modified']);
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
    const { wrapper, configuration } = mountAddon();

    fill(wrapper, { neighborV4Address: '10.115.53.2', ...values });

    await expect(wrapper.vm.saveBgp()).rejects.toStrictEqual([expect.stringContaining(errorKey)]);
    expect(configuration.save).not.toHaveBeenCalled();
  });
});
