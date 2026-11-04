import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
import HarvesterEditVolume from '../volume.vue';

// The form emits an update when it is created, so count only the updates that an interaction adds
const updates = (wrapper) => wrapper.emitted('update')?.length ?? 0;

describe('component: HarvesterEditVolume', () => {
  it('should display all the inputs', () => {
    const wrapper = mount(HarvesterEditVolume, {
      props:  { validateRequired: true },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
              'i18n/exists':                        jest.fn(),
            }
          },
        }
      }
    });

    const inputWraps = wrapper.findAll('[data-testid^=input-hev-]');

    expect(inputWraps).toHaveLength(4);
  });

  it('should emit an update on name input', async() => {
    const wrapper = mount(HarvesterEditVolume, {
      props:  { mode: _EDIT, validateRequired: true },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
              'i18n/exists':                        jest.fn(),
            }
          },
        }
      }
    });
    const before = updates(wrapper);
    const input = wrapper.find('[data-testid="input-hev-name"]').find('input');

    await input.setValue(123);

    expect(updates(wrapper)).toBeGreaterThan(before);
  });

  it('should emit an update on size input blur', async() => {
    const wrapper = mount(HarvesterEditVolume, {
      props:  { mode: _EDIT, validateRequired: true },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
              'i18n/exists':                        jest.fn(),
            }
          },
        }
      }
    });
    const input = wrapper.find('[data-testid="input-hev-size"]').find('input');

    // setting the value already emits an update, so the blur has to add one on top of that
    await input.setValue(123);

    const afterSetValue = updates(wrapper);

    await input.trigger('blur');

    expect(updates(wrapper)).toBeGreaterThan(afterSetValue);
  });

  it.each([
    'type',
    'bus'
  ])('should emit an update on %p selection change', async(field) => {
    const wrapper = mount(HarvesterEditVolume, {
      props:  { mode: _EDIT, validateRequired: true },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
              'i18n/exists':                        jest.fn(),
            }
          },
        }
      }
    });
    const before = updates(wrapper);
    const select = wrapper.find(`[data-testid="input-hev-${ field }"]`);

    select.find('button').trigger('click');
    await wrapper.trigger('keydown.down');
    await wrapper.trigger('keydown.enter');

    expect(updates(wrapper)).toBeGreaterThan(before);
  });
});
