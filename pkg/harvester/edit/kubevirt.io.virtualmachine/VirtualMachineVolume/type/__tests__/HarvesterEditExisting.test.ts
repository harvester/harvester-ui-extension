import { mount } from '@vue/test-utils';
import { _EDIT } from '@shell/config/query-params';
import HarvesterEditExisting from '../existing.vue';

describe('component: HarvesterEditExisting', () => {
  it('should display all the inputs', () => {
    const wrapper = mount(HarvesterEditExisting, {
      props: {
        mode: _EDIT, value: {}, rows: []
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      () => [],
              'i18n/t':                             jest.fn()
            }
          }
        }
      }
    });

    const inputWraps = wrapper.findAll('[data-testid^=input-hee-]');

    expect(inputWraps).toHaveLength(5);
  });

  it.each([
    'name',
  ])('should emit an update on %p input', (field) => {
    const wrapper = mount(HarvesterEditExisting, {
      props: {
        mode: _EDIT, value: {}, rows: []
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      () => [],
              'i18n/t':                             jest.fn()
            }
          }
        }
      }
    });
    const input = wrapper.find(`[data-testid="input-hee-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);

    expect(wrapper.emitted('update')).toHaveLength(1);
  });

  // TODO: #6179: Restore this test when the input is allowed to edit
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip.each([
    'size',
  ])('should emit an update on %p input and blur', (field) => {
    const wrapper = mount(HarvesterEditExisting, {
      props: {
        mode: _EDIT, value: {}, rows: []
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      () => [],
              'i18n/t':                             jest.fn()
            }
          }
        }
      }
    });
    const input = wrapper.find(`[data-testid="input-hee-${ field }"]`).find('input');
    const newValue = 123;

    input.setValue(newValue);
    input.trigger('blur');

    expect(wrapper.emitted('input')).toHaveLength(1);
  });

  it.each([
    'type',
    'volumeName',
    // 'bus',  // disabled
  ])('should emit an update on %p selection change', async(field) => {
    const wrapper = mount(HarvesterEditExisting, {
      props: {
        mode: _EDIT, value: {}, rows: []
      },
      global: {
        mocks: {
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => true,
              'harvester/all':                      () => [],
              'i18n/t':                             jest.fn()
            }
          }
        }
      }
    });
    const select = wrapper.find(`[data-testid="input-hee-${ field }"]`);

    select.find('button').trigger('click');
    await wrapper.trigger('keydown.down');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('update')).toHaveLength(1);
  });
  describe('lun (SCSI passthrough)', () => {
    // `prSetting` is the persistent-reservation-enabled setting, `featureEnabled` whether the cluster has it (v1.10+)
    const mountWith = (value, { prSetting = { value: 'true' }, featureEnabled = true } = {}) => mount(HarvesterEditExisting, {
      props: {
        mode: _EDIT, value, rows: []
      },
      global: {
        mocks: {
          $route: { params: { cluster: 'local' } },
          $store: {
            getters: {
              'harvester-common/getFeatureEnabled': () => featureEnabled,
              'harvester/all':                      () => [],
              'harvester/byId':                     () => prSetting,
              'i18n/t':                             jest.fn()
            }
          }
        },
        stubs: { 'router-link': true }
      }
    });

    const reservationCheckbox = (wrapper) => wrapper.find('[data-testid="input-hee-reservation"]').findComponent({ name: 'Checkbox' });

    it('should not offer lun for a volume that cannot be shared', () => {
      const wrapper = mountWith({});

      expect(wrapper.vm.typeOptions.map((o) => o.value)).toStrictEqual(['disk', 'cd-rom']);
    });

    it('should show the persistent reservation option only for lun disks', () => {
      expect(mountWith({ type: 'disk' }).find('[data-testid="input-hee-reservation"]').exists()).toBe(false);
      expect(mountWith({ type: 'lun' }).find('[data-testid="input-hee-reservation"]').exists()).toBe(true);
    });

    it('should offer the I/O error policy only for lun disks', () => {
      expect(mountWith({ type: 'disk' }).find('[data-testid="input-hee-errorPolicy"]').exists()).toBe(false);
      expect(mountWith({ type: 'lun' }).find('[data-testid="input-hee-errorPolicy"]').exists()).toBe(true);
    });

    it('should allow persistent reservation when the setting is enabled', () => {
      const wrapper = mountWith({ type: 'lun' }, { prSetting: { value: 'true', default: 'false' } });

      expect(wrapper.vm.persistentReservationAllowed).toBe(true);
      expect(wrapper.find('[data-testid="banner-hee-reservation-disabled"]').exists()).toBe(false);
    });

    it.each([
      ['disabled', { value: 'false', default: 'false' }],
      ['left at the default', { value: '', default: 'false' }],
      ['missing', null],
    ])('should block persistent reservation when the setting is %s', (_, prSetting) => {
      const wrapper = mountWith({ type: 'lun' }, { prSetting });

      expect(wrapper.vm.persistentReservationAllowed).toBe(false);
      expect(wrapper.find('[data-testid="banner-hee-reservation-disabled"]').exists()).toBe(true);
      expect(reservationCheckbox(wrapper).props('disabled')).toBe(true);
    });

    it('should keep an existing reservation editable when the setting is disabled', () => {
      const wrapper = mountWith({ type: 'lun', reservation: true }, { prSetting: { value: 'false' } });

      expect(reservationCheckbox(wrapper).props('disabled')).toBe(false);
    });

    it('should not restrict persistent reservation on clusters without the setting', () => {
      const wrapper = mountWith({ type: 'lun' }, { prSetting: null, featureEnabled: false });

      expect(wrapper.vm.persistentReservationAllowed).toBe(true);
    });
  });
});
