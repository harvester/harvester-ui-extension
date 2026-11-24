import { mount } from '@vue/test-utils';
import HarvesterImage from '../harvesterhci.io.virtualmachineimage.vue';

const rows = [
  {
    id: 'default/a', metadata: { namespace: 'default' }, labels: {}
  },
  {
    id: 'other/b', metadata: { namespace: 'other' }, labels: {}
  },
];

// Mirrors the real layout: `FilterLabel` lives in the `more-header-middle` slot, which
// `ResourceTable` only renders while grouping is on (i.e. more than one namespace selected).
function resourceTable() {
  return {
    name:     'ResourceTable',
    props:    ['rows'],
    template: '<div><slot name="more-header-middle" /></div>',
  };
}

function mountList() {
  return mount(HarvesterImage, {
    props:  { schema: { id: 'harvesterhci.io.virtualmachineimage' }, rows },
    global: {
      stubs: {
        Banner:        true,
        FilterLabel:   true,
        ResourceTable: resourceTable(),
      },
      mocks: { $store: { getters: { 'harvester-common/uploadingImages': () => [] } } },
    },
  });
}

describe('list: harvesterhci.io.virtualmachineimage', () => {
  it('shows the rows when the label filter is not mounted (single namespace on reload)', () => {
    const wrapper = mountList();
    const table = wrapper.findComponent({ name: 'ResourceTable' });

    expect(wrapper.vm.searchLabels).toStrictEqual([]);
    expect(table.props('rows')).toStrictEqual(rows);
  });

  it('uses the FilterLabel result once a label filter is applied', async() => {
    const wrapper = mountList();
    const filtered = [rows[0]];

    wrapper.vm.changeRows(filtered, [{ key: 'foo', value: 'bar' }]);
    await wrapper.vm.$nextTick();

    const table = wrapper.findComponent({ name: 'ResourceTable' });

    expect(table.props('rows')).toStrictEqual(filtered);
  });
});
