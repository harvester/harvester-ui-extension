import { shallowMount } from '@vue/test-utils';
import { _CREATE } from '@shell/config/query-params';
import { NODE, SECRET } from '@shell/config/types';
import { CSI_SECRETS } from '@pkg/harvester/config/harvester-map';
import LvmProvisioner from '../lvm.driver.harvesterhci.io.vue';

const SECRETS = [
  { id: 'default/lvm-key', isSystem: false },
  { id: 'harvester-system/system-secret', isSystem: true },
];

// The LVM provisioner form for a StorageClass with the given parameters, `encryption` being the lvmVolumeEncryption flag
function mountForm({ parameters = { type: 'dm-thin', vgName: 'vg01' }, encryption = true } = {}) {
  const dispatch = jest.fn(() => Promise.resolve([]));
  const value = {
    parameters,
    allowedTopologies:                 [],
    lvmVolumeEncryptionFeatureEnabled: encryption,
  };

  const wrapper = shallowMount(LvmProvisioner, {
    props:  {
      value, mode: _CREATE, realMode: _CREATE
    },
    global: {
      mocks: {
        $store: {
          dispatch,
          getters: {
            currentProduct:                       { inStore: 'harvester' },
            'harvester/all':                      (type) => (type === SECRET ? SECRETS : []),
            'harvester-common/getFeatureEnabled': (flag) => flag === 'lvmDmThinOnly',
          },
        },
      },
      stubs: {
        LabeledSelect: {
          name: 'LabeledSelect', template: '<div />', props: ['value', 'label', 'options']
        }
      },
    },
  });

  return {
    wrapper, value, dispatch
  };
}

const findByLabel = (wrapper, name, label) => wrapper.findAllComponents({ name }).find((c) => c.props('label') === label);

describe('edit: harvesterhci.io.storage LVM provisioner encryption', () => {
  it('should not offer volume encryption when the LVM driver does not support it', () => {
    const { wrapper } = mountForm({ encryption: false });

    expect(wrapper.findComponent({ name: 'RadioGroup' }).exists()).toBe(false);
    expect(findByLabel(wrapper, 'LabeledSelect', '%harvester.storage.secret%')).toBeUndefined();
  });

  it('should offer volume encryption, off by default, when the LVM driver supports it', () => {
    const { wrapper } = mountForm();
    const radio = wrapper.findComponent({ name: 'RadioGroup' });

    expect(radio.exists()).toBe(true);
    expect(radio.props('value')).toBe('false');
    expect(findByLabel(wrapper, 'LabeledSelect', '%harvester.storage.secret%')).toBeUndefined();
  });

  it('should ask for a secret once encryption is turned on', async() => {
    const { wrapper, value } = mountForm();

    wrapper.vm.volumeEncryption = 'true';
    await wrapper.vm.$nextTick();

    expect(value.parameters.encrypted).toBe('true');
    expect(findByLabel(wrapper, 'LabeledSelect', '%harvester.storage.secret%').props('options')).toStrictEqual(['default/lvm-key']);
  });

  it('should point all four CSI secret references at the selected secret', () => {
    const { wrapper, value } = mountForm({
      parameters: {
        type: 'dm-thin', vgName: 'vg01', encrypted: 'true'
      }
    });

    wrapper.vm.secret = 'default/lvm-key';

    expect(value.parameters).toStrictEqual({
      type:                                            'dm-thin',
      vgName:                                          'vg01',
      encrypted:                                       'true',
      [CSI_SECRETS.CSI_PROVISIONER_SECRET_NAME]:       'lvm-key',
      [CSI_SECRETS.CSI_PROVISIONER_SECRET_NAMESPACE]:  'default',
      [CSI_SECRETS.CSI_NODE_PUBLISH_SECRET_NAME]:      'lvm-key',
      [CSI_SECRETS.CSI_NODE_PUBLISH_SECRET_NAMESPACE]: 'default',
      [CSI_SECRETS.CSI_NODE_STAGE_SECRET_NAME]:        'lvm-key',
      [CSI_SECRETS.CSI_NODE_STAGE_SECRET_NAMESPACE]:   'default',
      [CSI_SECRETS.CSI_NODE_EXPAND_SECRET_NAME]:       'lvm-key',
      [CSI_SECRETS.CSI_NODE_EXPAND_SECRET_NAMESPACE]:  'default',
    });
    expect(wrapper.vm.secret).toBe('default/lvm-key');
  });

  it('should show no secret while the provisioner secret reference is incomplete', () => {
    const { wrapper } = mountForm({ parameters: { encrypted: 'true', [CSI_SECRETS.CSI_PROVISIONER_SECRET_NAME]: 'lvm-key' } });

    expect(wrapper.vm.secret).toBe('');
  });

  it.each([true, false])('should keep the encryption parameters out of the raw parameter editor (flag %p)', (encryption) => {
    const parameters = {
      type: 'dm-thin', vgName: 'vg01', encrypted: 'true', custom: 'x'
    };

    Object.values(CSI_SECRETS).forEach((key) => {
      parameters[key] = 'v';
    });

    const { wrapper } = mountForm({ parameters, encryption });

    expect(wrapper.vm.parameters).toStrictEqual({ custom: 'x' });
  });

  it.each([
    [true, [NODE, 'harvesterhci.io.lvmvolumegroup', SECRET]],
    [false, [NODE, 'harvesterhci.io.lvmvolumegroup']],
  ])('should only load secrets when encryption is available (flag %p)', async(encryption, types) => {
    const { wrapper, dispatch } = mountForm({ encryption });

    dispatch.mockClear();
    await LvmProvisioner.fetch.call(wrapper.vm);

    expect(dispatch.mock.calls.map(([, { type }]) => type)).toStrictEqual(types);
  });
});
