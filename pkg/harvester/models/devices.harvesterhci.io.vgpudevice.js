import SteveModel from '@shell/plugins/steve/steve-class';
import { escapeHtml } from '@shell/utils/string';

const STATUS_DISPLAY = {
  enabled: {
    displayKey: 'generic.enabled',
    color:      'bg-success'
  },
  pending: {
    displayKey: 'generic.inProgress',
    color:      'bg-info'
  },
  disabled: {
    displayKey: 'generic.disabled',
    color:      'bg-warning'
  },
  error: {
    displayKey: 'generic.disabled',
    color:      'bg-warning'
  }
};

/**
 * Class representing PCI Device resource.
 * @extends SteveModal
 */
export default class VGpuDevice extends SteveModel {
  get _availableActions() {
    const out = super._availableActions;

    out.push(
      {
        action:  'enableVGpu',
        enabled: !this.isEnabled,
        icon:    'icon icon-fw icon-dot',
        label:   'Enable',
      },
      {
        action:   'disableVGpu',
        enabled:  this.isEnabled,
        icon:     'icon icon-fw icon-dot-open',
        label:    'Disable',
        bulkable: true,
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

  goToDetail() {
    return false;
  }

  goToEdit() {
    return false;
  }

  get isEnabled() {
    return this?.spec?.enabled === true;
  }

  get isEnabling() {
    return this.status?.vGPUStatus && this.status?.vGPUStatus !== 'vGPUConfigured';
  }

  get statusDisplay() {
    if (this.isEnabling) {
      return STATUS_DISPLAY.pending;
    }
    if (this.isEnabled) {
      return STATUS_DISPLAY.enabled;
    }

    return STATUS_DISPLAY.disabled;
  }

  get stateDisplay() {
    const t = this.$rootGetters['i18n/t'];

    return t(this.statusDisplay.displayKey);
  }

  get stateBackground() {
    return this.statusDisplay.color;
  }

  enableVGpu(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'EnableVGpuDevice'
    });
  }

  async disableVGpu() {
    if (!this.allowDisable) {
      this.showDetachWarning();

      return;
    }

    const { vGPUTypeName, enabled } = this.spec;

    try {
      this.spec.vGPUTypeName = undefined;
      this.spec.enabled = false;
      await this.save();
    } catch (err) {
      this.spec.vGPUTypeName = vGPUTypeName;
      this.spec.enabled = enabled;

      this.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error', { name: escapeHtml(this.metadata.name) }),
        err,
      }, { root: true });
    }
  }

  get groupByNode() {
    const name = this.spec?.nodeName || this.$rootGetters['i18n/t']('generic.none');

    return this.$rootGetters['i18n/t']('resourceTable.groupLabel.node', { name: escapeHtml(name) });
  }

  get vGpuAvailableTypes() {
    return this.status?.availableTypes ? Object.keys(this.status.availableTypes) : [];
  }

  showDetachWarning() {
    this.$dispatch('growl/warning', {
      title:   this.$rootGetters['i18n/t']('harvester.vgpu.detachWarning.title'),
      message: this.$rootGetters['i18n/t']('harvester.vgpu.detachWarning.message'),
      timeout: 5000
    }, { root: true });
  }

  get allowDisable() {
    return this._allowDisable;
  }

  set allowDisable(value) {
    this._allowDisable = value;
  }
}
