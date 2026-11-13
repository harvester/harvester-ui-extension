import { shallowMount } from '@vue/test-utils';
import { RcButton } from '@components/RcButton';
import NovncConnectionStatus from '../NovncConnectionStatus.vue';

jest.mock('../ZoomableRFB', () => ({}));

describe('component: NovncConnectionStatus', () => {
  // A plain button takes the global 40px button height, taller than the 32px pill around it.
  it('should offer Reconnect as an RcButton when the console is disconnected', () => {
    const wrapper = shallowMount(NovncConnectionStatus, { props: { status: 'disconnected', label: 'Disconnected' } });
    const reconnect = wrapper.findComponent(RcButton);

    expect(reconnect.attributes('data-testid')).toBe('vnc-connection-reconnect');

    reconnect.vm.$emit('click');

    expect(wrapper.emitted('reconnect')).toHaveLength(1);
  });
});
