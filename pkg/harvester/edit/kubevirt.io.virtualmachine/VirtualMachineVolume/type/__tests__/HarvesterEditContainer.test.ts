import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
import HarvesterEditContainer from '../container.vue';

const mountOptions = () => ({
  props:  { mode: _EDIT, value: {} },
  global: {
    mocks: {
      $store: {
        getters: {
          'harvester-common/getFeatureEnabled': () => true,
          'i18n/t':                             jest.fn(),
        }
      }
    }
  }
});

describe('component: HarvesterEditContainer', () => {
  it('should display all the inputs', () => {
    const wrapper = mount(HarvesterEditContainer, mountOptions());

    const inputWraps = wrapper.findAll('[data-testid^=input-hec-]');

    expect(inputWraps).toHaveLength(4);
  });

  it.each([
    'name',
    'container',
  ])('should emit an update on %p input', (field) => {
    const wrapper = mount(HarvesterEditContainer, mountOptions());
    const input = wrapper.find(`[data-testid="input-hec-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it.each([
    'type',
    'bus',
  ])('should emit an update on %p selection change', async(field) => {
    const wrapper = mount(HarvesterEditContainer, mountOptions());
    const select = wrapper.find(`[data-testid="input-hec-${ field }"]`);

    select.find('button').trigger('click');
    await wrapper.trigger('keydown.down');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('update')).toHaveLength(1);
  });
});
