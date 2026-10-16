import { mount } from '@vue/test-utils';
import { _CREATE } from '@shell/config/query-params';
import HarvesterEditVMImage from '../vmImage.vue';

// The form emits an update when it is created, so count only the updates that an interaction adds
const updates = (wrapper) => wrapper.emitted('update')?.length ?? 0;

describe('component: HarvesterEditVMImage', () => {
  it('should display all the inputs', () => {
    const wrapper = mount(HarvesterEditVMImage, {
      props: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
            }
          },
        }
      }
    });

    const inputWraps = wrapper.findAll('[data-testid^=input-hevi-]');

    expect(inputWraps).toHaveLength(5);
  });

  it.each([
    'name',
  ])('should emit an update on %p input', (field) => {
    const wrapper = mount(HarvesterEditVMImage, {
      props: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
            }
          },
        }
      }
    });
    const input = wrapper.find(`[data-testid="input-hevi-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it.each([
    'size',
  ])('should emit an update on %p input blur', async(field) => {
    const wrapper = mount(HarvesterEditVMImage, {
      props: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
            }
          },
        }
      }
    });
    const input = wrapper.find(`[data-testid="input-hevi-${ field }"]`).find('input');
    const newValue = 123;

    // setting the value already emits an update, so the blur has to add one on top of that
    await input.setValue(newValue);

    const afterSetValue = updates(wrapper);

    await input.trigger('blur');

    expect(updates(wrapper)).toBeGreaterThan(afterSetValue);
  });

  it.each([
    'type',
    'image',
    'bus',
  ])('should emit an update on %p selection change', async(field) => {
    const wrapper = mount(HarvesterEditVMImage, {
      props: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      jest.fn(),
              'i18n/t':                             jest.fn(),
            }
          },
        }
      }
    });
    const select = wrapper.find(`[data-testid="input-hevi-${ field }"]`);

    select.find('button').trigger('click');
    await wrapper.trigger('keydown.down');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('update')).toHaveLength(1);
  });
});
