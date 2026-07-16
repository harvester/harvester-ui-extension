import SteveModel from '@shell/plugins/steve/steve-class';
import { escapeHtml } from '@shell/utils/string';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import { NODE } from '@shell/config/types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { HCI } from '../types';

/**
 * Class representing SR-IOV Device resource.
 * @extends SteveModal
 */
export default class SRIOVDevice extends SteveModel {
  get _availableActions() {
    const out = super._availableActions;

    out.push(
      {
        action:  'enableDevice',
        enabled: !this.isEnabled && this.canUpdate,
        icon:    'icon icon-fw icon-dot',
        label:   'Enable',
      },
      {
        action:  'disableDevice',
        enabled: this.isEnabled && this.canUpdate,
        icon:    'icon icon-fw icon-dot-open',
        label:   'Disable',
      },
    );

    return out;
  }

  get canUpdate() {
    return !!this.linkFor('update');
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
    return this.spec.enabled && this.status?.vfAddresses?.length > 0 && this.status?.vGPUDevices?.length > 0;
  }

  get isTimesliced() {
    return this.metadata?.annotations?.[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION] === 'true';
  }

  enableDevice() {
    this.$dispatch('promptModal', {
      resources: [this],
      component: 'EnableSriovGpuDevice'
    });
  }

  async disableDevice() {
    const inStore = this.$rootGetters['currentProduct'].inStore;
    const schema = this.$rootGetters[`${ inStore }/schemaFor`](HCI.VGPU_DEVICE);

    if (!!schema) {
      const vGpuDevices = this.$rootGetters[`${ inStore }/all`](HCI.VGPU_DEVICE) || [];
      const vGpuDevicesEnabled = vGpuDevices
        .filter((f) => f.labels[HCI_ANNOTATIONS.PARENT_SRIOV_GPU] === this.id && f.spec?.enabled)
        .map((m) => m.id);

      if (vGpuDevicesEnabled.length > 0) {
        this.$dispatch('growl/error', {
          title:   this.t('generic.notification.title.error', { name: escapeHtml(this.metadata.name) }),
          message: `
            Cannot disable ${ this.metadata.name }, following vGPU devices are enabled:
            [${ vGpuDevicesEnabled.join(', ') }]
          `,
        }, { root: true });

        return;
      }
    }

    try {
      this.spec.enabled = false;
      await this.save();
    } catch (err) {
      this.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error', { name: escapeHtml(this.metadata.name) }),
        err,
      }, { root: true });
    }
  }

  get realNodeName() {
    const inStore = this.$rootGetters['currentProduct'].inStore;
    const nodeName = this.spec?.nodeName;
    const nodes = this.$rootGetters[`${ inStore }/all`](NODE);
    const node = nodes.find((N) => N.id === nodeName);

    return node?.nameDisplay || '';
  }

  get numVFs() {
    return this.status?.vfAddresses?.length || 0;
  }

  get childDevice() {
    return HCI.VGPU_DEVICE;
  }
}
