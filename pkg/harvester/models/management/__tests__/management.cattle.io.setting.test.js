import { MANAGEMENT } from '@shell/config/types';
import { _EDIT, AS, _UNFLAG, MODE } from '@shell/config/query-params';
import ManagementSetting from '@shell/models/management.cattle.io.setting';
import HarvesterManagementSetting from '../management.cattle.io.setting';

jest.mock('@shell/models/management.cattle.io.setting', () => {
  return {
    __esModule: true,
    default:    class {
      goToEdit() {}
    },
  };
});

// A management setting as the store gives it, in the given product
function setting(id, product = 'harvester') {
  const push = jest.fn();
  const model = Object.create(HarvesterManagementSetting.prototype);

  Object.assign(model, {
    id,
    $rootGetters:  { currentProduct: { name: product }, currentCluster: { id: 'local' } },
    currentRouter: () => ({ push }),
  });

  return { model, push };
}

describe('class HarvesterManagementSetting', () => {
  it('should open a session setting in the Harvester settings form', () => {
    const { model, push } = setting('auth-user-session-idle-ttl-minutes');
    const superGoToEdit = jest.spyOn(ManagementSetting.prototype, 'goToEdit');

    model.goToEdit({ foo: 'bar' });

    expect(superGoToEdit).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({
      name:   'harvester-c-cluster-resource-id',
      params: {
        product: 'harvester', cluster: 'local', resource: MANAGEMENT.SETTING, id: 'auth-user-session-idle-ttl-minutes'
      },
      query: {
        [MODE]: _EDIT, [AS]: _UNFLAG, foo: 'bar'
      },
    });
  });

  it('should keep opening ui-pl in the branding page', () => {
    const { model, push } = setting('ui-pl');
    const superGoToEdit = jest.spyOn(ManagementSetting.prototype, 'goToEdit');

    model.goToEdit();

    expect(superGoToEdit).toHaveBeenCalledWith({});
    expect(push).not.toHaveBeenCalled();
  });

  it('should leave settings outside the harvester product to the shell', () => {
    const { model, push } = setting('auth-user-session-ttl-minutes', 'manager');
    const superGoToEdit = jest.spyOn(ManagementSetting.prototype, 'goToEdit');

    model.goToEdit();

    expect(superGoToEdit).toHaveBeenCalledWith({});
    expect(push).not.toHaveBeenCalled();
  });
});
