import SteveModel from '@shell/plugins/steve/steve-class';
import { escapeHtml } from '@shell/utils/string';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
// import { NODE } from '@shell/config/types';
// import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
// import { HCI } from '../types';

/**
 * Class representing vGPU MIGConfiguration resource.
 * @extends SteveModal
 */
export default class MIGCONFIGURATION extends SteveModel {
  get _availableActions() {
    let out = super._availableActions;

    out = out.map((action) => {
      if (action.action === 'goToEditYaml') {
        return { ...action, enabled: true };
      } else if (action.action === 'goToEdit') {
        return { ...action, enabled: !this.spec.enabled };
      } else {
        return action;
      }
    });

    out.push(
      {
        action:  'enableConfig',
        enabled: !this.isEnabled,
        icon:    'icon icon-fw icon-dot',
        label:   'Enable',
      },
      {
        action:  'disableConfig',
        enabled: this.isEnabled,
        icon:    'icon icon-fw icon-dot-open',
        label:   'Disable',
      },
    );

    return out;
  }

  get canYaml() {
    return false;
  }

  get canDelete() {
    return false;
  }

  get actualState() {
    return this.isEnabled ? 'Enabled' : 'Disabled';
  }

  get stateDisplay() {
    return this.actualState;
  }

  get stateColor() {
    const state = this.actualState;

    return colorForState(state);
  }

  get isEnabled() {
    return this.spec.enabled;
  }

  async enableConfig() {
    try {
      this.spec.enabled = true;
      await this.save();
    } catch (err) {
      this.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error', { name: escapeHtml(this.name) }),
        err,
      }, { root: true });
    }
  }

  async disableConfig() {
    const { enabled: currentEnabled } = this.spec;

    try {
      this.spec.enabled = false;
      await this.save();
    } catch (err) {
      this.spec.enabled = currentEnabled;
      this.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error', { name: escapeHtml(this.name) }),
        err,
      }, { root: true });
    }
  }
  // cleanForSave(data, _forNew) {
  //   console.log("🚀 ~ MIGCONFIGURATION ~ cleanForSave ~ data:", data)
  //   return data;
  // }
}
