import ManagementSetting from '@shell/models/management.cattle.io.setting';
import { HCI_SETTING } from '../../config/settings';

export default class HarvesterManagementSetting extends ManagementSetting {
  get _availableActions() {
    const actions = super._availableActions;

    if (this.$rootGetters['isStandaloneHarvester'] && this.id === HCI_SETTING.UI_PL) {
      return actions.filter((action) => !['goToClone', 'promptRemove'].includes(action.action));
    }

    return actions;
  }
}
