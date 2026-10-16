import { shallowMount } from '@vue/test-utils';
import NovncConsole, { CONSOLE_STATUS, CONSOLE_FAILURE } from '../NovncConsole.vue';

const mockInstances = [];

jest.mock('../ZoomableRFB', () => {
  return jest.fn().mockImplementation((el, url) => {
    const listeners = {};
    const rfb = {
      url,
      addEventListener:    jest.fn((name, cb) => {
        listeners[name] = cb;
      }),
      removeEventListener: jest.fn(),
      disconnect:          jest.fn(),
      focus:               jest.fn(),
      emit:                (name, detail) => listeners[name]?.({ detail }),
    };

    mockInstances.push(rfb);

    return rfb;
  });
});

const URL = 'wss://example.com/apis/subresources.kubevirt.io/v1/namespaces/default/virtualmachineinstances/vm/vnc';

const mountConsole = (props = {}) => {
  mockInstances.length = 0;
  jest.useFakeTimers();

  return shallowMount(NovncConsole, { props: { url: URL, ...props } });
};

const lastRFB = () => mockInstances[mockInstances.length - 1];

describe('component: NovncConsole', () => {
  it('should connect with preserveSession so an existing session is not kicked', async() => {
    mountConsole();
    await jest.runOnlyPendingTimersAsync();

    expect(new window.URL(lastRFB().url).searchParams.get('preserveSession')).toBe('true');
  });

  it('should keep retrying while the console is held by another session', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    lastRFB().emit('connect');

    // Dropped by another session taking over.
    lastRFB().emit('disconnect');
    expect(wrapper.vm.status).toBe(CONSOLE_STATUS.RECONNECTING);

    // The first retry is rejected because the other session is still active.
    jest.advanceTimersByTime(1000);
    lastRFB().emit('disconnect');

    expect(wrapper.vm.status).toBe(CONSOLE_STATUS.RECONNECTING);
    expect(wrapper.vm.retryTimes).toBe(2);
    expect(wrapper.vm.statusDetail).toBe('%harvester.virtualMachine.detail.console.status.inUse%');
    expect(new window.URL(lastRFB().url).searchParams.get('preserveSession')).toBe('true');
  });

  it('should fail with a take over option after the retries are exhausted', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    lastRFB().emit('connect');
    lastRFB().emit('disconnect');

    for (let i = 0; i < wrapper.vm.maximumRetryTimes; i++) {
      jest.runOnlyPendingTimers();
      lastRFB().emit('disconnect');
    }

    expect(wrapper.vm.status).toBe(CONSOLE_STATUS.FAILED);
    expect(wrapper.vm.failure).toBe(CONSOLE_FAILURE.IN_USE);
    expect(wrapper.vm.isClosed).toBe(false);
  });

  it('should show the console as in use when a running VM refuses the first connection', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    lastRFB().emit('disconnect');

    expect(wrapper.vm.status).toBe(CONSOLE_STATUS.FAILED);
    expect(wrapper.vm.failure).toBe(CONSOLE_FAILURE.IN_USE);
    expect(wrapper.vm.canTakeOver).toBe(true);
  });

  it('should not claim the console is in use when the VM is not running', async() => {
    const wrapper = mountConsole({ vmRunning: false });

    await jest.runOnlyPendingTimersAsync();
    lastRFB().emit('disconnect');

    expect(wrapper.vm.failure).toBe(CONSOLE_FAILURE.UNAVAILABLE);
  });

  it('should only take over after the modal is confirmed', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    const connections = mockInstances.length;

    wrapper.vm.takeOver();
    expect(wrapper.vm.showTakeOverModal).toBe(true);
    expect(mockInstances).toHaveLength(connections);

    wrapper.vm.confirmTakeOver();

    expect(wrapper.vm.showTakeOverModal).toBe(false);
    expect(new window.URL(lastRFB().url).searchParams.get('preserveSession')).toBe('false');
  });

  it('should not take over when the modal is cancelled', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    const connections = mockInstances.length;

    wrapper.vm.takeOver();
    wrapper.vm.cancelTakeOver();

    expect(wrapper.vm.showTakeOverModal).toBe(false);
    expect(mockInstances).toHaveLength(connections);
  });

  it('should focus the console once it connects, so typing reaches the VM', async() => {
    mountConsole();

    await jest.runOnlyPendingTimersAsync();
    lastRFB().emit('connect');

    expect(lastRFB().focus).toHaveBeenCalledWith();
  });

  it('should mark the console while it has keyboard focus', async() => {
    const wrapper = mountConsole();
    const view = wrapper.find('.novnc-screen');

    await jest.runOnlyPendingTimersAsync();

    view.element.dispatchEvent(new FocusEvent('focusin'));
    await wrapper.vm.$nextTick();
    expect(view.classes()).toContain('is-focused');

    view.element.dispatchEvent(new FocusEvent('focusout'));
    await wrapper.vm.$nextTick();
    expect(view.classes()).not.toContain('is-focused');
  });

  describe('when the cluster does not support preserveSession', () => {
    it('should connect without the parameter and offer no take over', async() => {
      const wrapper = mountConsole({ preserveSession: false });

      await jest.runOnlyPendingTimersAsync();
      expect(new window.URL(lastRFB().url).searchParams.has('preserveSession')).toBe(false);

      lastRFB().emit('disconnect');

      expect(wrapper.vm.failure).toBe(CONSOLE_FAILURE.UNAVAILABLE);
      expect(wrapper.vm.canTakeOver).toBe(false);
    });

    it('should not reconnect on its own after the session drops', async() => {
      const wrapper = mountConsole({ preserveSession: false });

      await jest.runOnlyPendingTimersAsync();
      lastRFB().emit('connect');
      const connections = mockInstances.length;

      lastRFB().emit('disconnect');
      jest.runOnlyPendingTimers();

      expect(wrapper.vm.status).toBe(CONSOLE_STATUS.DISCONNECTED);
      expect(wrapper.vm.failure).toBe(CONSOLE_FAILURE.DROPPED);
      expect(wrapper.vm.showError).toBe(true);
      expect(mockInstances).toHaveLength(connections);
    });
  });

  it('should close the socket when credentials are required', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    const rfb = lastRFB();

    rfb.emit('credentialsrequired');

    expect(rfb.disconnect).toHaveBeenCalledWith();
    expect(wrapper.vm.rfb).toBeNull();
    expect(wrapper.vm.status).toBe(CONSOLE_STATUS.FAILED);
  });
});
