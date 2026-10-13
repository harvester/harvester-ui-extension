import { shallowMount } from '@vue/test-utils';
import NovncConsole, { CONSOLE_STATUS } from '../NovncConsole.vue';

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
      emit:                (name, detail) => listeners[name]?.({ detail }),
    };

    mockInstances.push(rfb);

    return rfb;
  });
});

const URL = 'wss://example.com/apis/subresources.kubevirt.io/v1/namespaces/default/virtualmachineinstances/vm/vnc';

const mountConsole = () => {
  mockInstances.length = 0;
  jest.useFakeTimers();

  return shallowMount(NovncConsole, {
    props:  { url: URL },
    global: { stubs: { BrandImage: true } },
  });
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
    expect(wrapper.vm.isClosed).toBe(false);
  });

  it('should take over without preserveSession after confirmation', async() => {
    const wrapper = mountConsole();

    await jest.runOnlyPendingTimersAsync();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    wrapper.vm.takeOver();

    expect(new window.URL(lastRFB().url).searchParams.get('preserveSession')).toBe('false');
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
