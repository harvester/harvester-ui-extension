import { mount } from '@vue/test-utils';
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';
import YamlEditor from '@shell/components/YamlEditor';
import { HCI } from '@pkg/harvester/config/labels-annotations';
import HarvesterEditCloudTemplate from '../harvesterhci.io.cloudtemplate.vue';

const OLD_CONFIG = '#cloud-config\npassword: old\n';
const NEW_CONFIG = '#cloud-config\npassword: new\n';

// A cloud-config template as the store gives it, `save` records what would be sent to the API
function cloudTemplate({ isNew = false } = {}) {
  const value = {
    type:     'configmap',
    metadata: {
      name:      'tpl',
      namespace: 'default',
      ...(isNew ? {} : { labels: { [HCI.CLOUD_INIT]: 'user' } }),
    },
    data:      isNew ? undefined : { cloudInit: OLD_CONFIG },
    $dispatch: jest.fn(),
    save:      () => Promise.resolve(),
    saved:     [],
  };

  jest.spyOn(value, 'save').mockImplementation(() => {
    value.saved.push(JSON.parse(JSON.stringify({ metadata: value.metadata, data: value.data })));

    return Promise.resolve();
  });

  return value;
}

// The real shell YamlEditor, with only its CodeMirror editor stubbed, so the events the form listens to are the
// ones the shell emits
function mountForm(mode, value) {
  return mount(HarvesterEditCloudTemplate, {
    props:  { value, mode },
    global: {
      stubs: {
        CruResource:       { template: '<div><slot /></div>' },
        Tabbed:            { template: '<div><slot /></div>' },
        Tab:               { template: '<div><slot /></div>' },
        NameNsDescription: true,
        LabeledSelect:     true,
        CodeMirror:        {
          name: 'CodeMirror', template: '<div />', emits: ['onInput', 'onReady', 'validationChanged']
        },
        FileDiff: true,
      },
      mocks: {
        $store: {
          getters: {
            'prefs/get':           jest.fn(),
            'type-map/isSpoofed':  () => false,
            currentStore:          () => 'harvester',
            'harvester/schemaFor': () => ({ linkFor: () => '/v1/harvester/configmaps' }),
            'i18n/t':              (key) => key,
          },
        },
        $router: { replace: jest.fn() },
        $route:  {
          name: 'c-cluster-product-resource-id', params: {}, query: {}
        },
      },
    },
  });
}

// What a user typing in the editor does: CodeMirror reports the new text to the YamlEditor
async function typeInEditor(wrapper, text) {
  wrapper.findComponent(YamlEditor).findComponent({ name: 'CodeMirror' }).vm.$emit('onInput', text);
  await wrapper.vm.$nextTick();
}

describe('component: HarvesterEditCloudTemplate', () => {
  it('should save the edited cloud config when editing a template', async() => {
    const value = cloudTemplate();
    const wrapper = mountForm(_EDIT, value);

    await typeInEditor(wrapper, NEW_CONFIG);
    await wrapper.vm.save(jest.fn());

    expect(value.save).toHaveBeenCalledTimes(1);
    expect(value.saved[0].data).toStrictEqual({ cloudInit: NEW_CONFIG });
  });

  it('should keep the template type label when editing a template', async() => {
    const value = cloudTemplate();
    const wrapper = mountForm(_EDIT, value);

    await typeInEditor(wrapper, NEW_CONFIG);
    await wrapper.vm.save(jest.fn());

    expect(value.saved[0].metadata.labels).toStrictEqual({ [HCI.CLOUD_INIT]: 'user' });
  });

  it('should save the last text when the cloud config is edited several times', async() => {
    const value = cloudTemplate();
    const wrapper = mountForm(_EDIT, value);

    await typeInEditor(wrapper, '#cloud-config\n');
    await typeInEditor(wrapper, NEW_CONFIG);
    await wrapper.vm.save(jest.fn());

    expect(value.saved[0].data).toStrictEqual({ cloudInit: NEW_CONFIG });
  });

  it('should save the cloud config unchanged when only saving a template', async() => {
    const value = cloudTemplate();
    const wrapper = mountForm(_EDIT, value);

    await wrapper.vm.save(jest.fn());

    expect(value.saved[0].data).toStrictEqual({ cloudInit: OLD_CONFIG });
  });

  it('should save the cloud config and the template type when creating a template', async() => {
    const value = cloudTemplate({ isNew: true });
    const wrapper = mountForm(_CREATE, value);

    await typeInEditor(wrapper, NEW_CONFIG);
    await wrapper.vm.save(jest.fn());

    expect(value.save).toHaveBeenCalledWith({ url: '/v1/harvester/configmaps' });
    expect(value.saved[0]).toStrictEqual({
      metadata: {
        name: 'tpl', namespace: 'default', labels: { [HCI.CLOUD_INIT]: 'user' }
      },
      data: { cloudInit: NEW_CONFIG },
    });
  });

  it('should show the template cloud config in the editor when viewing a template', () => {
    const value = cloudTemplate();
    const wrapper = mountForm(_VIEW, value);

    expect(wrapper.findComponent(YamlEditor).props('value')).toBe(OLD_CONFIG);
    expect(value.data).toStrictEqual({ cloudInit: OLD_CONFIG });
  });
});
