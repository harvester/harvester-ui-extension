import { mount } from '@vue/test-utils';
import HarvesterVPC from '../kubeovn.io.vpc.vue';

// A table that renders the page's group header for each of the given groups
function resourceTable(groups) {
  return {
    data:     () => ({ groups }),
    template: '<div><div v-for="group in groups" :key="group.key" class="group"><slot name="group-by" :group="group" /></div></div>',
  };
}

function mountList(groups) {
  return mount(HarvesterVPC, {
    props:  { schema: { id: 'kubeovn.io.vpc' } },
    data:   () => ({ enabledKubeOvnAddon: true }),
    global: {
      stubs: {
        ResourceTable: resourceTable(groups),
        Masthead:      true,
        Loading:       true,
        'router-link': { template: '<a><slot /></a>' },
      },
      mocks: {
        $fetchState: { pending: false },
        t:           (key) => ({ 'harvester.vpc.label': 'Virtual Private Cloud', 'generic.none': 'None' }[key] || key),
        $store:      {
          getters: {
            currentProduct:        { inStore: 'harvester' },
            'harvester/all':       () => [],
            'harvester/schemaFor': () => ({ collectionMethods: ['POST'] }),
          },
        },
      },
    },
  });
}

describe('list: kubeovn.io.vpc', () => {
  it('should label a group of subnets without a VPC as None and offer no VPC actions', () => {
    const wrapper = mountList([{ key: '' }]);
    const group = wrapper.find('.group');

    expect(group.find('.group-tab').text()).toBe('Virtual Private Cloud: None');
    expect(group.find('.right').exists()).toBe(false);
  });

  it('should label a VPC group with its name and offer the VPC actions', () => {
    const wrapper = mountList([{ key: 'ovn-cluster' }]);
    const group = wrapper.find('.group');

    expect(group.find('.group-tab').text()).toBe('Virtual Private Cloud: ovn-cluster');
    expect(group.findAll('.right a, .right button')).toHaveLength(3);
  });
});
