import { mount } from '@vue/test-utils';
import HarvesterListNetworks from '../harvesterhci.io.networkattachmentdefinition.vue';
import { HCI as HCI_ANNOTATIONS } from '../../config/labels-annotations';

const rows = [
  {
    id:       'default/net-default',
    metadata: { namespace: 'default', annotations: {} },
  },
  {
    id:       'test-ns/net-test',
    metadata: { namespace: 'test-ns', annotations: {} },
  },
  {
    id:       'kube-system/net-overlay',
    metadata: { namespace: 'kube-system', annotations: {} },
  },
  {
    id:       'test-ns/net-storage',
    metadata: {
      namespace:   'test-ns',
      annotations: { [HCI_ANNOTATIONS.STORAGE_NETWORK]: 'true' },
    },
  },
];

function mountList({ isAllNamespaces = false, includedNamespaces = {} } = {}) {
  return mount(HarvesterListNetworks, {
    data:   () => ({ rows, hostNetworks: [] }),
    global: {
      stubs: {
        Banner:        true,
        Loading:       true,
        BadgeState:    true,
        ResourceTable: {
          name:     'ResourceTable',
          props:    ['rows'],
          template: '<div />',
        },
      },
      mocks: {
        $fetchState: { pending: false },
        $store:      {
          getters: {
            isAllNamespaces,
            namespaces: () => includedNamespaces,
          },
        },
      },
    },
  });
}

describe('list: harvesterhci.io.networkattachmentdefinition', () => {
  it('filters out default and other unselected namespaces when a specific namespace is selected', () => {
    const wrapper = mountList({
      isAllNamespaces:    false,
      includedNamespaces: { 'test-ns': true },
    });
    const table = wrapper.findComponent({ name: 'ResourceTable' });

    expect(table.props('rows')).toStrictEqual([rows[1]]);
  });

  it('includes active user namespaces and kube-system when All Namespaces is selected', () => {
    const wrapper = mountList({
      isAllNamespaces:    true,
      includedNamespaces: {
        default:   true,
        'test-ns': true,
      },
    });
    const table = wrapper.findComponent({ name: 'ResourceTable' });

    expect(table.props('rows')).toStrictEqual([rows[0], rows[1], rows[2]]);
  });
});
