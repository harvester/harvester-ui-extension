import EditSubnet from '../index.vue';

const BGP_ANNOTATION = 'ovn.kubernetes.io/bgp';
const { bgpEnabled } = EditSubnet.computed;

function createContext(annotations) {
  const value = {
    metadata: annotations ? { annotations: { ...annotations } } : {},
    setAnnotation(key, val) {
      if (val) {
        this.metadata.annotations = { ...this.metadata.annotations, [key]: val };
      } else if (this.metadata.annotations) {
        delete this.metadata.annotations[key];
      }
    },
  };

  return {
    value,
    get bgpEnabled() {
      return bgpEnabled.get.call(this);
    },
  };
}

describe('edit: kubeovn.io.subnet BGP', () => {
  it.each([
    [undefined, false],
    [{}, false],
    [{ [BGP_ANNOTATION]: 'false' }, false],
    [{ [BGP_ANNOTATION]: 'true' }, true],
    [{ [BGP_ANNOTATION]: 'cluster' }, true],
    [{ [BGP_ANNOTATION]: 'local' }, true],
  ])('should read the annotations %j as BGP enabled = %s', (annotations, expected) => {
    expect(createContext(annotations).bgpEnabled).toBe(expected);
  });

  it('should add the BGP annotation when BGP is enabled', () => {
    const context = createContext();

    bgpEnabled.set.call(context, true);

    expect(context.value.metadata.annotations).toStrictEqual({ [BGP_ANNOTATION]: 'true' });
  });

  it('should remove the BGP annotation when BGP is disabled', () => {
    const context = createContext({ [BGP_ANNOTATION]: 'true', other: 'kept' });

    bgpEnabled.set.call(context, false);

    expect(context.value.metadata.annotations).toStrictEqual({ other: 'kept' });
  });

  it('should keep a "local" annotation set outside the form when BGP stays enabled', () => {
    const context = createContext({ [BGP_ANNOTATION]: 'local' });

    bgpEnabled.set.call(context, true);

    expect(context.value.metadata.annotations).toStrictEqual({ [BGP_ANNOTATION]: 'local' });
  });
});

describe('edit: kubeovn.io.subnet BGP speaker hint', () => {
  function fetchContext({ featureEnabled = true, configuration } = {}) {
    const dispatch = jest.fn((action) => {
      if (action === 'harvester/find') {
        return configuration instanceof Error ? Promise.reject(configuration) : Promise.resolve(configuration);
      }

      return Promise.resolve([]);
    });

    return {
      bgpFeatureEnabled: featureEnabled,
      bgpSpeakerOff:     false,
      $store:            {
        dispatch,
        getters: {
          currentProduct:        { inStore: 'harvester' },
          'harvester/schemaFor': () => ({}),
        },
      },
    };
  }

  it.each([
    ['no speaker hosts', { spec: { bgp: { neighborAS: 64512 } } }, true],
    ['speaker hosts', { spec: { bgp: { nodeNames: 'node-1' } } }, false],
  ])('should know whether a host runs the BGP speaker: %s', async(_, configuration, speakerOff) => {
    const context = fetchContext({ configuration });

    await EditSubnet.fetch.call(context);

    expect(context.$store.dispatch).toHaveBeenCalledWith('harvester/find', { type: 'kubeovn.io.configuration', id: 'kube-system/kubeovn' });
    expect(context.bgpSpeakerOff).toBe(speakerOff);
  });

  it('should not warn when the Kube-OVN configuration cannot be read', async() => {
    const context = fetchContext({ configuration: new Error('forbidden') });

    await EditSubnet.fetch.call(context);

    expect(context.bgpSpeakerOff).toBe(false);
  });

  it('should not read the Kube-OVN configuration on Harvester versions without BGP support', async() => {
    const context = fetchContext({ featureEnabled: false });

    await EditSubnet.fetch.call(context);

    expect(context.$store.dispatch).not.toHaveBeenCalledWith('harvester/find', expect.anything());
  });

  it('should link to the BGP tab of the kubeovn-operator add-on', () => {
    expect(EditSubnet.computed.bgpAddonLocation.call({})).toStrictEqual({
      name:   'harvester-c-cluster-resource-namespace-id',
      params: {
        resource: 'harvesterhci.io.addon', namespace: 'kube-system', id: 'kubeovn-operator'
      },
      query: { mode: 'edit' },
      hash:  '#bgp',
    });
  });
});
