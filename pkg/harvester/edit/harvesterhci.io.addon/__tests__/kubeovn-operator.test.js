import { reactive } from 'vue';
import { shallowMount } from '@vue/test-utils';
import EditAddonKubeovnOperator from '../kubeovn-operator.vue';

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

// latest: what the API returns at save time, when it differs from the copy loaded with the form
function mountAddon({
  enabled = true, featureEnabled = true, mode = 'edit', configuration = createConfiguration(), latest = null
} = {}) {
  const dispatch = jest.fn((action, payload) => {
    if (action === 'harvester/find') {
      return Promise.resolve(latest || configuration);
    }

    if (action === 'harvester/clone') {
      return Promise.resolve(payload.resource);
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
        $fetchState: { pending: false },
        t:           (key, args) => (args ? `${ key } ${ JSON.stringify(args) }` : key),
        $store:      {
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

  if (configuration) {
    wrapper.vm.loadBgp(configuration.spec.bgp);
  }

  return {
    wrapper, configuration, dispatch, registerBeforeHook
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

describe('edit: kubeovn-operator add-on BGP', () => {
  it('should save the BGP tab before the add-on', () => {
    const { wrapper, registerBeforeHook } = mountAddon();

    expect(registerBeforeHook).toHaveBeenCalledWith(wrapper.vm.saveBgp, 'saveBgp');
  });

  it('should load an untouched install as disabled, without the placeholder values', async() => {
    const { wrapper, dispatch } = mountAddon();

    await EditAddonKubeovnOperator.fetch.call(wrapper.vm);

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
    const { wrapper } = mountAddon({ configuration });

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

  it('should split the neighbors by family, drop duplicates and keep the rest of the configuration', async() => {
    const { wrapper, configuration } = mountAddon();

    fill(wrapper, {
      nodeNames: ['node-1', 'node-2'],
      neighbors: [' 10.115.53.2 ', '2001:db8::2', '10.115.53.3', '10.115.53.2', ''],
      nextHopV4: '10.115.48.1',
      nextHopV6: '2001:db8::9',
    });

    await wrapper.vm.saveBgp();

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
  });

  it('should save on top of the latest copy of the configuration', async() => {
    // the operator updated the Configuration after the form loaded it
    const latest = createConfiguration();

    latest.spec = {
      enableBGP: false, ovnCentral: { replicas: 3 }, bgp: { ...PLACEHOLDER_BGP }
    };
    const { wrapper, configuration, dispatch } = mountAddon({ latest });

    fill(wrapper);

    await wrapper.vm.saveBgp();

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

  it('should not save the configuration again when Save is pressed again', async() => {
    const { wrapper, configuration } = mountAddon();

    fill(wrapper);

    await wrapper.vm.saveBgp();
    // e.g. the add-on save failed and the user presses Save again
    await wrapper.vm.saveBgp();

    expect(configuration.save).toHaveBeenCalledTimes(1);
  });

  it('should only remove the speaker hosts when BGP is disabled', async() => {
    const { wrapper, configuration } = mountAddon({ configuration: createConfiguration(CONFIGURED_BGP) });

    // invalid values are ignored while disabled
    fill(wrapper, { bgpEnabled: false, neighborAS: '' });

    await wrapper.vm.saveBgp();

    const { nodeNames, ...rest } = CONFIGURED_BGP;

    expect(configuration.spec.bgp).toStrictEqual(rest);
  });

  it.each([
    ['an untouched install', PLACEHOLDER_BGP],
    ['a configured speaker', CONFIGURED_BGP],
  ])('should not save the configuration when nothing changed on %s', async(_, bgp) => {
    const { wrapper, configuration } = mountAddon({ configuration: createConfiguration(bgp) });

    await wrapper.vm.saveBgp();

    expect(configuration.save).not.toHaveBeenCalled();
  });

  it('should not load BGP on Harvester versions without BGP support', async() => {
    const { wrapper, dispatch } = mountAddon({ featureEnabled: false, configuration: null });

    await EditAddonKubeovnOperator.fetch.call(wrapper.vm);

    expect(dispatch).not.toHaveBeenCalled();
    expect(wrapper.vm.showBgp).toBe(false);
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
    fill(wrapper);

    await expect(wrapper.vm.saveBgp()).rejects.toStrictEqual(['the object has been modified']);
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
  ])('should not save %s', async(_, values, errorKey) => {
    const { wrapper, configuration } = mountAddon();

    fill(wrapper, values);

    await expect(wrapper.vm.saveBgp()).rejects.toStrictEqual([expect.stringContaining(errorKey)]);
    expect(configuration.save).not.toHaveBeenCalled();
  });

  it('should flag a router ID inline as soon as a second host is picked', async() => {
    const { wrapper } = mountAddon();
    const [rule] = wrapper.vm.routerIDRules;

    fill(wrapper, { routerID: '10.115.48.1' });
    expect(rule('10.115.48.1')).toBeUndefined();

    await wrapper.setData({ nodeNames: ['node-1', 'node-2'] });
    expect(rule('10.115.48.1')).toContain('harvester.bgp.validation.routerIDMultipleHosts');
  });
});
