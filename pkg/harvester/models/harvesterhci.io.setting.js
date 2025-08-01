import { findBy } from '@shell/utils/array';
import { HCI } from '../types';
import { HCI_ALLOWED_SETTINGS, HCI_SETTING } from '../config/settings';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import HarvesterResource from './harvester';

export default class HciSetting extends HarvesterResource {
  get _availableActions() {
    const toFilter = ['cloneYaml', 'download', 'goToEditYaml', 'goToViewYaml', 'goToViewConfig', 'promptRemove'];
    const settingMetadata = HCI_ALLOWED_SETTINGS[this.id];

    let out = super._availableActions;

    // Some settings are not editable
    if ( settingMetadata?.readOnly || this.fromEnv ) {
      toFilter.push('goToEdit');
    }

    out = out.filter((action) => {
      return (!toFilter.includes(action.action));
    });

    // Change the label on the first action (edit)
    const editAction = out.find((action) => action.action === 'goToEdit');

    if (editAction) {
      editAction.label = this.t('advancedSettings.edit.label');
    }

    const schema = this.$getters['schemaFor'](HCI.UPGRADE);

    const hasUpgradeAccess = !!schema?.collectionMethods.find((x) => ['post'].includes(x.toLowerCase()));

    if (this.id === HCI_SETTING.SERVER_VERSION && hasUpgradeAccess) {
      out.unshift({
        action:   'goToAirgapUpgrade',
        enabled:  true,
        icon:     'icon icon-refresh',
        label:    this.t('harvester.upgradePage.upgrade'),
      });
    }

    return out;
  }

  goToAirgapUpgrade() {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-airgapupgrade`,
      params: { cluster: this.$rootGetters['currentCluster'].id, product: 'harvester' },
    });
  }

  get customValue() {
    if (this.metadata.name === HCI_SETTING.STORAGE_NETWORK) {
      try {
        return JSON.stringify(JSON.parse(this.value), null, 2);
      } catch (e) {}
    }

    return false;
  }

  get customFormatter() {
    if (this.metadata.name === HCI_SETTING.STORAGE_NETWORK) {
      try {
        JSON.stringify(JSON.parse(this.value), null, 2);

        return 'json';
      } catch (e) {

      }
    }

    return false;
  }

  get backupTargetIsEmpty() {
    return !this.value;
  }

  get errMessage() {
    const configuredCondition = findBy((this?.status?.conditions || []), 'type', 'configured') || {};

    if (this.metadata?.state?.error === true) {
      return this.metadata.state.message;
    } else if (configuredCondition?.status === 'False') {
      return configuredCondition.message;
    } else {
      return false;
    }
  }

  get valueOrDefaultValue() {
    return this.value || this.default;
  }

  get currentVersion() {
    return this.value || '';
  }

  get displayValue() { // Select the field you want to display
    if (this.id === 'backup-target') {
      return this.parseValue?.endpoint || ' ';
    }

    return null;
  }

  get parseValue() {
    try {
      if (this.value) {
        return JSON.parse(this.value);
      } else if (this.default) {
        return JSON.parse(this.default);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse setting value or default:', err);
    }

    return {};
  }

  get isS3() {
    return this.parseValue.type === 's3';
  }

  get isNFS() {
    return this.parseValue.type === 'nfs';
  }

  get customValidationRules() {
    const id = this.id;

    const out = [];

    switch (id) {
    case 'backup-target':
      out.push( {
        nullable:   false,
        path:       'value',
        type:       'string',
        validators: ['backupTarget'],
      });
      break;
    case 'ntp-servers':
      out.push( {
        nullable:   true,
        path:       'value',
        validators: ['ntpServers'],
      });
      break;
    }

    return out;
  }
}
