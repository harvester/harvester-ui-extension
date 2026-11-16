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
