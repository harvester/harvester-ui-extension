import { mount } from '@vue/test-utils';
import SimpleSecretSelector from '@shell/components/form/SimpleSecretSelector.vue';
import ResourceLabeledSelect from '@shell/components/form/ResourceLabeledSelect.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { SECRET } from '@shell/config/types';
import { PRODUCT_NAME } from '../../../../../../config/harvester';

const secret = (namespace, name, type = 'Opaque') => ({
  id: `${ namespace }/${ name }`, namespace, name, _type: type, data: { url: 'aHR0cHM6Ly9leGFtcGxl' }
});

const secrets = [
  secret('monitoring', 'slack-webhook'),
  secret('monitoring', 'vm-cloud-init', 'secret'),
  secret('other', 'slack-webhook-elsewhere'),
];

const mountSelector = () => mount(SimpleSecretSelector, {
  props:  {
    namespace: 'monitoring', initialName: '', initialKey: ''
  },
  global: {
    stubs: { LabeledSelect: true },
    mocks: {
      $fetchState: { pending: false },
      $store:      {
        getters: {
          currentStore:                            () => PRODUCT_NAME,
          [`${ PRODUCT_NAME }/paginationEnabled`]: () => false,
          [`${ PRODUCT_NAME }/all`]:               (type) => (type === SECRET ? secrets : []),
        },
        dispatch: jest.fn().mockResolvedValue(undefined),
      },
    },
  },
});

describe('alertmanager receiver: secret selector in the harvester store', () => {
  it('should list the secrets of the namespace without server-side pagination', async() => {
    const wrapper = mountSelector();
    const resourceSelect = wrapper.findComponent(ResourceLabeledSelect);

    await resourceSelect.vm.$options.fetch.call(resourceSelect.vm);
    await wrapper.vm.$nextTick();

    const secretSelect = resourceSelect.findComponent(LabeledSelect);

    // A paginate fn makes LabeledSelect fetch pages from the API and ignore the options,
    // and the Harvester API returns no secrets for that request
    expect(secretSelect.props('paginate')).toBeNull();
    expect(secretSelect.props('options').map((o) => o.label)).toStrictEqual(['None', 'slack-webhook']);
  });
});
