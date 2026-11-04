import ManagementSetting from '@shell/models/management.cattle.io.setting';
import { MANAGEMENT } from '@shell/config/types';
import { DEFAULT_PERF_SETTING } from '@shell/config/settings';
import { _EDIT, AS, _UNFLAG, MODE } from '@shell/config/query-params';
import { getPerformanceSetting } from '@shell/utils/settings';
import { HCI_SETTING } from '../../config/settings';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';

export default class HarvesterManagementSetting extends ManagementSetting {
  get _availableActions() {
    const actions = super._availableActions;

    if (this.$rootGetters['isStandaloneHarvester'] && this.id === HCI_SETTING.UI_PL) {
      return actions.filter((action) => !['goToClone', 'promptRemove'].includes(action.action));
    }

    return actions;
  }

  get customValue() {
    if (this.id === HCI_SETTING.UI_PERFORMANCE) {
      return `${ getPerformanceSetting(this.$rootGetters).disableWebsocketNotification }`;
    }

    return super.customValue;
  }

  // Harvester only exposes one option of ui-performance, so it's only modified when that option is. The settings list compares the value of the others
  get hasCustomized() {
    if (this.id === HCI_SETTING.UI_PERFORMANCE) {
      return getPerformanceSetting(this.$rootGetters).disableWebsocketNotification !== DEFAULT_PERF_SETTING.disableWebsocketNotification;
    }

    return undefined;
  }

  goToEdit(moreQuery = {}) {
    // The shell sends every Rancher setting in Harvester to the branding page, which only fits ui-pl
    if (this.$rootGetters['currentProduct']?.name !== HARVESTER_PRODUCT || this.id === HCI_SETTING.UI_PL) {
      return super.goToEdit(moreQuery);
    }

    this.currentRouter().push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-id`,
      params: {
        product:  HARVESTER_PRODUCT,
        cluster:  this.$rootGetters['currentCluster'].id,
        resource: MANAGEMENT.SETTING,
        id:       this.id,
      },
      query: {
        [MODE]: _EDIT, [AS]: _UNFLAG, ...moreQuery
      },
    });
  }
}
