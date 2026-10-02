import { mount } from '@vue/test-utils';
import { _CREATE } from '@shell/config/query-params';
import HarvesterEditVMImage from '../vmImage.vue';

describe('component: HarvesterEditVMImage', () => {
  it('should display all the inputs', () => {
    const wrapper = mount(HarvesterEditVMImage, {
      propsData: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      mocks: {
        $store: {
          getters: {
            'harvester/all': jest.fn(),
            'i18n/t':        jest.fn(),
          }
        },
      }
    });

    const inputWraps = wrapper.findAll('[data-testid^=input-hevi-]');

    expect(inputWraps).toHaveLength(5);
  });

  it.each([
    'name',
  ])('should emit an update on %p input', (field) => {
    const wrapper = mount(HarvesterEditVMImage, {
      propsData: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      mocks: {
        $store: {
          getters: {
            'harvester/all': jest.fn(),
            'i18n/t':        jest.fn(),
          }
        },
      }
    });
    const input = wrapper.find(`[data-testid="input-hevi-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it.each([
    'size',
  ])('should emit an update on %p input blur', (field) => {
    const wrapper = mount(HarvesterEditVMImage, {
      propsData: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      mocks: {
        $store: {
          getters: {
            'harvester/all': jest.fn(),
            'i18n/t':        jest.fn(),
          }
        },
      }
    });
    const input = wrapper.find(`[data-testid="input-hevi-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);
    input.trigger('blur');

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it.each([
    'type',
    'image',
    'bus',
  ])('should emit an update on %p selection change', async(field) => {
    const wrapper = mount(HarvesterEditVMImage, {
      propsData: {
        mode:             _CREATE,
        isVirtualType:    false,
        newCreateId:      '123',
        validateRequired: true,
        idx:              1
      },
      mocks: {
        $store: {
          getters: {
            'harvester/all': jest.fn(),
            'i18n/t':        jest.fn(),
          }
        },
      }
    });
    const select = wrapper.find(`[data-testid="input-hevi-${ field }"]`);

    select.find('button').trigger('click');
    await wrapper.trigger('keydown.down');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  it('keeps a deleted source image for an existing third-party disk', () => {
    const value = {
      image:            'default/deleted',
      realName:         'vm-disk-0',
      storageClassName: 'lvm',
      size:             '10Gi',
      accessMode:       'ReadWriteOnce',
      volumeMode:       'Block'
    };
    const dispatch = jest.fn();
    const context = {
      value,
      isVirtualType:              true,
      isCreate:                   false,
      isExistingThirdPartyVolume: false,
      pvcsResource:               { status: { phase: 'Bound' } },
      imagesOption:               [{ value: 'default/available' }],
      $store:                     {
        getters: {
          'harvester/all': () => [{ name: 'lvm', isLonghorn: false }],
          'i18n/t':        jest.fn()
        },
        dispatch
      }
    };

    context.isExistingThirdPartyVolume = HarvesterEditVMImage.computed.isExistingThirdPartyVolume.call(context);
    HarvesterEditVMImage.methods.checkImageExists.call(context, value.image);

    expect(dispatch).not.toHaveBeenCalled();
    expect(value.image).toBe('default/deleted');

    context.isCreate = true;
    context.isExistingThirdPartyVolume = HarvesterEditVMImage.computed.isExistingThirdPartyVolume.call(context);
    HarvesterEditVMImage.methods.checkImageExists.call(context, value.image);

    expect(dispatch).toHaveBeenCalledWith('growl/error', expect.any(Object), { root: true });
    expect(value.image).toBe('');
  });
});
