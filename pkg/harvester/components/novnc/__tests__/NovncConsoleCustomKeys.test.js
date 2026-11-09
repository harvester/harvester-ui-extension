import { reactive } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { RcButton } from '@components/RcButton';
import NovncConsoleCustomKeys from '../NovncConsoleCustomKeys.vue';
import { SHORTCUTS_PREFERENCE, SHORTCUT_NAMES_PREFERENCE } from '../shortcuts';

const key = (value, code) => ({ key: value, code });

const CTRL_F2 = [key('Control', 'ControlLeft'), key('F2', 'F2')];
const CTRL_SPACE = [key('Control', 'ControlLeft'), key(' ', 'Space')];
const ALT_T = [key('Alt', 'AltLeft'), key('t', 'KeyT')];

const mountKeys = (saved = []) => {
  // Reactive like the store's, so the list follows what is saved.
  const preference = reactive({
    data: { [SHORTCUTS_PREFERENCE]: JSON.stringify(saved) },
    save: jest.fn().mockResolvedValue(),
  });

  const wrapper = shallowMount(NovncConsoleCustomKeys, {
    props:  { show: true },
    global: {
      mocks: { $store: { getters: { 'management/all': () => [preference] } } },
      stubs: { RcModal: { template: '<div><slot /></div>' }, Banner: { template: '<div><slot /></div>' } },
    },
  });

  return { wrapper, preference };
};

const listed = (wrapper) => wrapper.findAll('[data-testid="vnc-custom-shortcut"]');

const removeShortcut = async(wrapper, index) => {
  listed(wrapper)[index].findComponent(RcButton).vm.$emit('click');
  await flushPromises();
};

const savedKeys = (preference) => JSON.parse(preference.data[SHORTCUTS_PREFERENCE]);

describe('component: NovncConsoleCustomKeys', () => {
  it('should offer to remove every saved shortcut', () => {
    const { wrapper } = mountKeys([CTRL_F2, ALT_T]);

    expect(listed(wrapper).map((item) => item.findComponent(RcButton).exists())).toStrictEqual([true, true]);
  });

  it('should save the list without the shortcut that was removed', async() => {
    const { wrapper, preference } = mountKeys([CTRL_F2, ALT_T]);

    await removeShortcut(wrapper, 0);

    expect(preference.save).toHaveBeenCalledTimes(1);
    expect(savedKeys(preference)).toStrictEqual([ALT_T]);
    expect(listed(wrapper)).toHaveLength(1);
  });

  it('should remove a shortcut with the Space key in it', async() => {
    const { wrapper, preference } = mountKeys([CTRL_SPACE, ALT_T]);

    await removeShortcut(wrapper, 0);

    expect(savedKeys(preference)).toStrictEqual([ALT_T]);
  });

  it('should keep the shortcut when removing it cannot be saved, and say so in the dialog', async() => {
    const { wrapper, preference } = mountKeys([CTRL_F2, ALT_T]);

    preference.save.mockRejectedValue(new Error('forbidden'));
    await removeShortcut(wrapper, 0);

    expect(savedKeys(preference)).toStrictEqual([CTRL_F2, ALT_T]);
    expect(listed(wrapper)).toHaveLength(2);
    expect(wrapper.find('[data-testid="vnc-custom-keys-error"]').text()).toBe('%harvester.virtualMachine.detail.console.customKeys.saveError%: forbidden');

    await wrapper.setProps({ show: false });

    expect(wrapper.find('[data-testid="vnc-custom-keys-error"]').exists()).toBe(false);
  });

  it('should save a new shortcut straight away, with its name', async() => {
    const { wrapper, preference } = mountKeys([CTRL_F2]);

    wrapper.vm.keys = ALT_T;
    wrapper.vm.name = ' Task manager ';
    await wrapper.vm.add();

    expect(savedKeys(preference)).toStrictEqual([CTRL_F2, ALT_T]);
    expect(JSON.parse(preference.data[SHORTCUT_NAMES_PREFERENCE])).toStrictEqual({ 'AltLeft+KeyT': 'Task manager' });
    expect(wrapper.vm.keys).toStrictEqual([]);
  });
});
