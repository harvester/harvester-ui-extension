import { escapeHtml } from '@shell/utils/string';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import HarvesterResource from './harvester';

/**
 * Class representing vGPU MIGConfiguration resource.
 * @extends HarvesterResource
 */
export default class MIGCONFIGURATION extends HarvesterResource {
  get _availableActions() {
    let out = super._availableActions;

    out = out.map((action) => {
      if (action.action === 'showConfiguration') {
        return { ...action, enabled: !this.spec.enabled };
      } else if (action.action === 'goToEditYaml') {
        return { ...action, enabled: !this.spec.enabled };
      } else if (action.action === 'goToEdit') {
        // need to wait for status to be disabled or empty value, then allow user to editConfig
        return { ...action, enabled: !this.spec.enabled && ['disabled', ''].includes(this.configStatus) };
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

  get disableResourceDetailDrawer() {
    return true;
  }

  get canDelete() {
    return false;
  }

  get configStatus() {
    return this.status.status;
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

  get configuredProfiles() {
    const configuredProfiles = this.spec?.profileSpec?.filter((p) => p.requested > 0) || [];

    if (configuredProfiles.length === 0) {
      return '';
    }

    return configuredProfiles
      .map((profile) => `${ profile.name } * ${ profile.requested }`)
      .join(', ');
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
}
