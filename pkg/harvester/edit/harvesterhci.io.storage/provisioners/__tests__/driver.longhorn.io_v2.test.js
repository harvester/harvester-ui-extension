import { shallowMount } from '@vue/test-utils';
import { _CREATE, _EDIT } from '@shell/config/query-params';
import { Banner } from '@components/Banner';
import RadioGroup from '@components/Form/Radio/RadioGroup';
import KeyValue from '@shell/components/form/KeyValue';
import DriverLonghornIOV2 from '../driver.longhorn.io_v2.vue';

const rdmaNode = (status) => ({
  spec:   { tags: [], disks: {} },
  status: { conditions: [{ type: 'RDMACapable', status }] },
});

function mountDriver({
  parameters, nodes = [], rdmaFeature = true, realMode = _EDIT
} = {}) {
  const value = {
    parameters:                            { ...parameters },
    thirdPartyStorageFeatureEnabled:       true,
    longhornV2RdmaTransportFeatureEnabled: rdmaFeature,
  };

  return shallowMount(DriverLonghornIOV2, {
    props:  {
      value, mode: realMode, realMode
    },
    global: {
      mocks: {
        $store: {
          getters: {
            currentProduct:  { inStore: 'harvester' },
            'harvester/all': (type) => (type === 'longhorn.io.node' ? nodes : []),
          },
        },
      },
    },
  });
}

const transportRadio = (wrapper) => wrapper.findAllComponents(RadioGroup).find((r) => r.props('name') === 'dataEngineTransport');

describe('provisioner: driver.longhorn.io_v2', () => {
  it('should not show the transport option when the longhornV2RdmaTransport feature is disabled', () => {
    const wrapper = mountDriver({ realMode: _CREATE, rdmaFeature: false });

    expect(transportRadio(wrapper)).toBeUndefined();
  });

  it('should default a new StorageClass to TCP without a dataEngineTransport parameter', () => {
    const wrapper = mountDriver({ realMode: _CREATE, nodes: [rdmaNode('True')] });

    expect(transportRadio(wrapper).props('value')).toBe('tcp');
    expect(wrapper.props('value').parameters).not.toHaveProperty('dataEngineTransport');
  });

  it('should disable the transport option and show a banner when no node is RDMA-capable', () => {
    const wrapper = mountDriver({ nodes: [rdmaNode('False')] });

    expect(transportRadio(wrapper).props('disabled')).toBe(true);
    expect(wrapper.findComponent(Banner).exists()).toBe(true);
  });

  it('should enable the transport option without a banner when a node reports RDMACapable=True', () => {
    const wrapper = mountDriver({ nodes: [rdmaNode('False'), rdmaNode('True')] });

    expect(transportRadio(wrapper).props('disabled')).toBe(false);
    expect(wrapper.findComponent(Banner).exists()).toBe(false);
  });

  it('should keep the option enabled for a class that already uses RDMA, so it can be switched back to TCP', () => {
    const wrapper = mountDriver({ parameters: { dataEngineTransport: 'rdma' } });

    expect(transportRadio(wrapper).props('value')).toBe('rdma');
    expect(transportRadio(wrapper).props('disabled')).toBe(false);
  });

  it('should write dataEngineTransport for RDMA and remove it again for TCP', async() => {
    const wrapper = mountDriver({ parameters: { dataEngine: 'v2' }, nodes: [rdmaNode('True')] });

    transportRadio(wrapper).vm.$emit('update:value', 'rdma');
    await wrapper.vm.$nextTick();
    expect(wrapper.props('value').parameters).toStrictEqual({ dataEngine: 'v2', dataEngineTransport: 'rdma' });

    transportRadio(wrapper).vm.$emit('update:value', 'tcp');
    await wrapper.vm.$nextTick();
    expect(wrapper.props('value').parameters).toStrictEqual({ dataEngine: 'v2' });
  });

  it('should leave dataEngineTransport out of the free-form parameters when the managed option is shown', () => {
    const wrapper = mountDriver({ parameters: { dataEngineTransport: 'rdma', foo: 'bar' } });

    expect(wrapper.findComponent(KeyValue).props('value')).toStrictEqual({ foo: 'bar' });
  });

  it('should keep dataEngineTransport in the free-form parameters when the feature is disabled', () => {
    const wrapper = mountDriver({ parameters: { dataEngineTransport: 'rdma', foo: 'bar' }, rdmaFeature: false });

    expect(wrapper.findComponent(KeyValue).props('value')).toStrictEqual({ dataEngineTransport: 'rdma', foo: 'bar' });
  });
});
