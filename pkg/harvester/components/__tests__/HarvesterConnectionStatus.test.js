import { reactive, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { EVENT_CONNECTING, EVENT_CONNECTED, EVENT_DISCONNECTED, EVENT_DISCONNECT_ERROR } from '@shell/utils/socket';
import HarvesterConnectionStatus from '../HarvesterConnectionStatus.vue';

const GRACE_PERIOD_MS = 10 * 1000;

jest.useFakeTimers();

// A store with the harvester socket in its state, `product` is the name of the current product
function createStore({ product = 'harvester', socket = new EventTarget() } = {}) {
  return {
    state:   reactive({ harvester: { socket } }),
    getters: {
      isVirtualCluster: true,
      currentProduct:   { name: product },
      'i18n/t':         (key) => key,
    },
  };
}

function mountStatus(store) {
  return mount(HarvesterConnectionStatus, { global: { provide: { store } } });
}

const indicator = (wrapper) => wrapper.find('[data-testid="harvester-connection-status"]');

describe('component: HarvesterConnectionStatus', () => {
  it('should not show the indicator while the socket is connected', () => {
    const wrapper = mountStatus(createStore());

    expect(indicator(wrapper).exists()).toBe(false);
  });

  it('should only show the indicator once a disconnect lasts longer than the grace period', async() => {
    const store = createStore();
    const wrapper = mountStatus(store);

    store.state.harvester.socket.dispatchEvent(new Event(EVENT_DISCONNECTED));
    jest.advanceTimersByTime(GRACE_PERIOD_MS - 1);
    await nextTick();
    expect(indicator(wrapper).exists()).toBe(false);

    jest.advanceTimersByTime(1);
    await nextTick();
    expect(indicator(wrapper).exists()).toBe(true);
    expect(indicator(wrapper).text()).toContain('harvester.connectionStatus.label');
    expect(indicator(wrapper).find('.sr-only').text()).toBe('harvester.connectionStatus.reconnecting');
    expect(indicator(wrapper).find('button').exists()).toBe(false);
  });

  it('should treat a retried close, which emits connecting, as a disconnect', async() => {
    const store = createStore();
    const wrapper = mountStatus(store);

    store.state.harvester.socket.dispatchEvent(new Event(EVENT_CONNECTING));
    jest.advanceTimersByTime(GRACE_PERIOD_MS);
    await nextTick();

    expect(indicator(wrapper).exists()).toBe(true);
  });

  it('should not show the indicator when the socket reconnects within the grace period', async() => {
    const store = createStore();
    const wrapper = mountStatus(store);
    const socket = store.state.harvester.socket;

    socket.dispatchEvent(new Event(EVENT_DISCONNECTED));
    jest.advanceTimersByTime(GRACE_PERIOD_MS / 2);
    socket.dispatchEvent(new Event(EVENT_CONNECTED));
    jest.advanceTimersByTime(GRACE_PERIOD_MS);
    await nextTick();

    expect(indicator(wrapper).exists()).toBe(false);
  });

  it('should clear the indicator when the socket reconnects', async() => {
    const store = createStore();
    const wrapper = mountStatus(store);
    const socket = store.state.harvester.socket;

    socket.dispatchEvent(new Event(EVENT_DISCONNECTED));
    jest.advanceTimersByTime(GRACE_PERIOD_MS);
    await nextTick();
    expect(indicator(wrapper).exists()).toBe(true);

    socket.dispatchEvent(new Event(EVENT_CONNECTED));
    await nextTick();
    expect(indicator(wrapper).exists()).toBe(false);
  });

  it('should show the indicator with a Reload button right away when the socket gives up', async() => {
    const store = createStore();
    const wrapper = mountStatus(store);

    store.state.harvester.socket.dispatchEvent(new Event(EVENT_DISCONNECT_ERROR));
    await nextTick();

    expect(indicator(wrapper).exists()).toBe(true);
    expect(indicator(wrapper).find('.sr-only').text()).toBe('harvester.connectionStatus.gaveUp');
    expect(indicator(wrapper).find('button').text()).toContain('harvester.connectionStatus.reload');
  });

  it('should listen to a socket that is created after it is mounted', async() => {
    const store = createStore({ socket: null });
    const wrapper = mountStatus(store);
    const socket = new EventTarget();

    store.state.harvester.socket = socket;
    await nextTick();
    socket.dispatchEvent(new Event(EVENT_DISCONNECT_ERROR));
    await nextTick();

    expect(indicator(wrapper).exists()).toBe(true);
  });

  it('should stop listening to the socket when it is unmounted', () => {
    const socket = new EventTarget();
    const removeEventListener = jest.spyOn(socket, 'removeEventListener');
    const wrapper = mountStatus(createStore({ socket }));

    wrapper.unmount();

    expect(removeEventListener).toHaveBeenCalledWith(EVENT_CONNECTED, expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith(EVENT_DISCONNECT_ERROR, expect.any(Function));
  });

  it('should not show the indicator outside the harvester product', async() => {
    const store = createStore({ product: 'explorer' });
    const wrapper = mountStatus(store);

    store.state.harvester.socket.dispatchEvent(new Event(EVENT_DISCONNECT_ERROR));
    await nextTick();

    expect(indicator(wrapper).exists()).toBe(false);
  });
});
