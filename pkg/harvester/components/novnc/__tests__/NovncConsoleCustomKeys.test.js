import { shallowMount } from '@vue/test-utils';
import Banner from '@components/Banner/Banner.vue';
import NovncConsoleCustomKeys from '../NovncConsoleCustomKeys.vue';

const PREFERED_SHORTCUT_KEYS = 'prefered-shortcut-keys';

const key = (value) => ({ key: value, code: value });

const CTRL_F2 = [key('Control'), key('F2')];
const CTRL_SPACE = [key('Control'), key(' ')];
const ALT_T = [key('Alt'), key('t')];

const mountKeys = (saved = []) => {
  const preference = {
    data: { [PREFERED_SHORTCUT_KEYS]: JSON.stringify(saved) },
    save: jest.fn().mockResolvedValue(),
  };

  const wrapper = shallowMount(NovncConsoleCustomKeys, {
    global: {
      mocks: { $store: { getters: { 'management/all': () => [preference] } } },
      stubs: { ModalWithCard: { template: '<div><slot name="content" /></div>' } },
    },
  });

  return { wrapper, preference };
};

const listed = (wrapper) => wrapper.find('.displayed-banners').findAllComponents(Banner);

const closeBanner = async(wrapper, index) => {
  listed(wrapper)[index].vm.$emit('close');
  await wrapper.vm.$nextTick();
};

const savedAfterDone = async(wrapper, preference) => {
  await wrapper.vm.saveKeys(jest.fn());

  return JSON.parse(preference.data[PREFERED_SHORTCUT_KEYS]);
};

describe('component: NovncConsoleCustomKeys', () => {
  it('should offer to remove every listed shortcut', () => {
    const { wrapper } = mountKeys([CTRL_F2, ALT_T]);

    expect(listed(wrapper).map((banner) => banner.props('closable'))).toStrictEqual([true, true]);
  });

  it('should save without the shortcut that was removed', async() => {
    const { wrapper, preference } = mountKeys([CTRL_F2, ALT_T]);

    await closeBanner(wrapper, 0);

    expect(listed(wrapper)).toHaveLength(1);
    expect(preference.save).not.toHaveBeenCalled();

    await expect(savedAfterDone(wrapper, preference)).resolves.toStrictEqual([ALT_T]);
    expect(preference.save).toHaveBeenCalledTimes(1);
  });

  it('should remove a shortcut with the Space key in it', async() => {
    const { wrapper, preference } = mountKeys([CTRL_SPACE, ALT_T]);

    await closeBanner(wrapper, 0);

    await expect(savedAfterDone(wrapper, preference)).resolves.toStrictEqual([ALT_T]);
  });

  it('should tell a shortcut that was just added from the saved ones', async() => {
    const { wrapper, preference } = mountKeys([CTRL_F2]);

    wrapper.vm.keysRecord = ALT_T;
    wrapper.vm.addShortcutKey();
    await wrapper.vm.$nextTick();

    // Just added shortcuts are listed first.
    await closeBanner(wrapper, 1);

    await expect(savedAfterDone(wrapper, preference)).resolves.toStrictEqual([ALT_T]);
  });

  it('should keep the saved shortcuts when it is closed without saving', async() => {
    const { wrapper, preference } = mountKeys([CTRL_F2, ALT_T]);

    await closeBanner(wrapper, 0);
    wrapper.vm.closeRecordingModal();

    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(preference.save).not.toHaveBeenCalled();
    expect(JSON.parse(preference.data[PREFERED_SHORTCUT_KEYS])).toStrictEqual([CTRL_F2, ALT_T]);
  });
});
