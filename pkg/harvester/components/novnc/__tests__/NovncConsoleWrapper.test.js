import { shallowMount } from '@vue/test-utils';
import NovncConsoleWrapper, { CONFIRM_ACTION } from '../NovncConsoleWrapper.vue';

jest.mock('../ZoomableRFB', () => ({ normalizeZoom: (value) => value }));
jest.mock('@novnc/novnc/core/input/keysym', () => ({}), { virtual: true });
jest.mock('@novnc/novnc/core/input/util', () => ({}), { virtual: true });

const consoleRef = {
  ctrlAltDelete: jest.fn(),
  focus:         jest.fn(),
};

const CHECKBOX = { name: 'Checkbox' };

const mountWrapper = ({ preferences = [] } = {}) => {
  // The console settings are saved there, so one test's would load in the next.
  window.localStorage.clear();
  consoleRef.ctrlAltDelete.mockClear();
  consoleRef.focus.mockClear();

  const wrapper = shallowMount(NovncConsoleWrapper, {
    props: {
      value: {
        id: 'default/vm', metadata: { name: 'vm' }, status: { phase: 'Running' }
      }
    },
    global: {
      mocks: {
        $store: {
          getters: {
            'management/all':                     () => preferences,
            'harvester-common/getFeatureEnabled': () => true,
          },
        },
        $fetchState: { pending: false },
      },
      stubs: {
        NovncConsole: {
          template: '<div />',
          methods:  {
            ctrlAltDelete: consoleRef.ctrlAltDelete,
            focus:         consoleRef.focus,
          },
        },
      },
    },
  });

  wrapper.vm.onStatusChanged({ status: 'connected' });

  return wrapper;
};

describe('component: NovncConsoleWrapper', () => {
  it('should only send Ctrl+Alt+Del after it is confirmed', async() => {
    const wrapper = mountWrapper();

    wrapper.vm.ctrlAltDelete();
    expect(wrapper.vm.confirmAction).toBe(CONFIRM_ACTION.CTRL_ALT_DEL);
    expect(consoleRef.ctrlAltDelete).not.toHaveBeenCalled();

    wrapper.vm.runConfirmedAction();

    expect(consoleRef.ctrlAltDelete).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.confirmAction).toBeNull();
  });

  it('should not send Ctrl+Alt+Del when the confirmation is cancelled', () => {
    const wrapper = mountWrapper();

    wrapper.vm.ctrlAltDelete();
    wrapper.vm.cancelConfirm();

    expect(consoleRef.ctrlAltDelete).not.toHaveBeenCalled();
    expect(wrapper.vm.confirmAction).toBeNull();
  });

  it('should only soft reboot after it is confirmed', () => {
    const wrapper = mountWrapper();
    const doSoftReboot = jest.fn();

    wrapper.vm.vmResource = { doSoftReboot };

    wrapper.vm.softReboot();
    expect(doSoftReboot).not.toHaveBeenCalled();

    wrapper.vm.runConfirmedAction();
    expect(doSoftReboot).toHaveBeenCalledTimes(1);
  });

  it('should keep the shortcut menu open to use while keys cannot be sent, and say why', () => {
    const wrapper = mountWrapper();

    wrapper.vm.onStatusChanged({ status: 'reconnecting' });

    expect(wrapper.vm.shortcutMenuProps.canSend).toBe(false);
    expect(wrapper.vm.sendBlockedReason).toBe('%harvester.virtualMachine.detail.console.shortcutMenu.blockedDisconnected%');
    // Without a user preference there is nothing to manage either, so only then is it disabled.
    expect(wrapper.vm.shortcutMenuProps.disabled).toBe(true);
  });

  it('should keep the shortcut menu enabled while disconnected when there are shortcuts to manage', () => {
    const wrapper = mountWrapper({ preferences: [{ data: {} }] });

    wrapper.vm.onStatusChanged({ status: 'reconnecting' });

    expect(wrapper.vm.shortcutMenuProps.canSend).toBe(false);
    expect(wrapper.vm.shortcutMenuProps.disabled).toBe(false);
  });

  it('should disable the shortcut menu, managing shortcuts included, while view only is on', () => {
    const wrapper = mountWrapper({ preferences: [{ data: {} }] });

    expect(wrapper.vm.shortcutMenuProps.disabled).toBe(false);

    wrapper.vm.setViewOnly(true);

    expect(wrapper.vm.shortcutMenuProps.disabled).toBe(true);
  });

  it('should disable Ctrl+Alt+Del and Soft reboot while view only is on', async() => {
    const wrapper = mountWrapper();
    const doSoftReboot = jest.fn();
    const button = (id) => wrapper.find(`[data-testid="${ id }"]`);

    wrapper.vm.vmResource = { doSoftReboot, actions: { softreboot: 'url' } };
    await wrapper.vm.$nextTick();

    expect(button('vnc-soft-reboot').attributes('disabled')).toBe('false');
    expect(button('vnc-ctrl-alt-del').attributes('disabled')).toBe('false');

    wrapper.vm.setViewOnly(true);
    await wrapper.vm.$nextTick();

    expect(button('vnc-soft-reboot').attributes('disabled')).toBe('true');
    expect(button('vnc-ctrl-alt-del').attributes('disabled')).toBe('true');

    wrapper.vm.softReboot();
    wrapper.vm.ctrlAltDelete();

    expect(wrapper.vm.confirmAction).toBeNull();
    expect(doSoftReboot).not.toHaveBeenCalled();
  });

  it('should say so under the console while view only is on', async() => {
    const wrapper = mountWrapper();
    const hint = () => wrapper.find('.console-area__hint').text();

    expect(hint()).toBe('%harvester.virtualMachine.detail.console.hint%');

    wrapper.vm.setViewOnly(true);
    await wrapper.vm.$nextTick();

    expect(hint()).toBe('%harvester.virtualMachine.detail.console.hintViewOnly%');
  });

  it('should not send keys while view only is on', () => {
    const wrapper = mountWrapper();

    wrapper.vm.setViewOnly(true);

    expect(wrapper.vm.canSendKeys).toBe(false);
  });

  it('should switch view only with the checkbox, and not repeat it in the connection status', async() => {
    const wrapper = mountWrapper();
    const checkbox = () => wrapper.findComponent(CHECKBOX);

    expect(checkbox().props('value')).toBe(false);

    checkbox().vm.$emit('update:value', true);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.settings.viewOnly).toBe(true);
    expect(checkbox().props('value')).toBe(true);
    expect(wrapper.vm.statusLabel).toBe('%harvester.virtualMachine.detail.console.status.connected%');
  });

  it('should give the console the keyboard when view only is turned off, not when it is turned on', async() => {
    const wrapper = mountWrapper();

    wrapper.vm.setViewOnly(true);
    await wrapper.vm.$nextTick();
    expect(consoleRef.focus).not.toHaveBeenCalled();

    wrapper.vm.setViewOnly(false);
    await wrapper.vm.$nextTick();
    expect(consoleRef.focus).toHaveBeenCalledTimes(1);
  });

  it('should not ask to send Ctrl+Alt+Del while keys cannot be sent', () => {
    const wrapper = mountWrapper();

    wrapper.vm.onStatusChanged({ status: 'reconnecting' });
    wrapper.vm.ctrlAltDelete();

    expect(wrapper.vm.confirmAction).toBeNull();
  });

  describe('in full screen', () => {
    it('should fill the window whatever the saved view mode, and go back to it afterwards', () => {
      const wrapper = mountWrapper();

      wrapper.vm.updateSettings({ ...wrapper.vm.settings, viewMode: 'none' });
      expect(wrapper.vm.rfbSettings).toMatchObject({ scaleViewport: false, edgeToEdge: false });

      wrapper.vm.isFullscreen = true;
      expect(wrapper.vm.rfbSettings).toMatchObject({ scaleViewport: true, edgeToEdge: true });

      wrapper.vm.isFullscreen = false;
      expect(wrapper.vm.rfbSettings).toMatchObject({ scaleViewport: false, edgeToEdge: false });
    });

    it('should leave the view only checkbox out of the bar, and keep view only as it was', async() => {
      const wrapper = mountWrapper();

      wrapper.vm.setViewOnly(true);
      wrapper.vm.isFullscreen = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.findComponent(CHECKBOX).exists()).toBe(false);
      expect(wrapper.vm.rfbSettings.viewOnly).toBe(true);
      expect(wrapper.vm.shortcutMenuProps.disabled).toBe(true);

      wrapper.vm.isFullscreen = false;
      await wrapper.vm.$nextTick();

      expect(wrapper.findComponent(CHECKBOX).props('value')).toBe(true);
    });

    it('should leave Ctrl+Alt+Del out of the bar', async() => {
      const wrapper = mountWrapper();

      wrapper.vm.isFullscreen = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="vnc-fullscreen-bar"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="vnc-ctrl-alt-del"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="vnc-fullscreen-ctrl-alt-del"]').exists()).toBe(false);
    });
  });
});
