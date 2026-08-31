import jsyaml from 'js-yaml';
import startCase from 'lodash/startCase';
import { HCI as HCI_ANNOTATIONS } from '../config/labels-annotations';
import HarvesterResource from './harvester';
import { HCI } from '../types';

const HARVESTER_NVIDIA_DRIVER_TOOLKIT = 'harvester-system/nvidia-driver-toolkit';
const RANCHER_VCLUSTER = 'harvester-system/rancher-vcluster';
const RANCHER_K3K = 'k3k-system/k3k';

export default class HciAddonConfig extends HarvesterResource {
  get availableActions() {
    const out = super._availableActions;

    if (this.id === RANCHER_VCLUSTER || this.id === RANCHER_K3K) {
      const rancherDashboard = {
        action:  'goToRancher',
        enabled: this.spec.enabled,
        icon:    'icon icon-external-link',
        label:   this.t('harvester.addons.rancherVcluster.accessRancher'),
      };

      out.push(rancherDashboard);
    }

    const canUpdate = !!this.linkFor('update');
    const toggleAddon = {
      action:  'toggleAddon',
      enabled: canUpdate,
      icon:    this.spec.enabled ? 'icon icon-pause' : 'icon icon-play',
      label:   this.spec.enabled ? this.t('generic.disable') : this.t('generic.enable'),
    };

    out.unshift(toggleAddon);

    return out;
  }

  async toggleAddon() {
    const enableHistory = this.spec.enabled;

    try {
      if (!this.spec.enabled && this.id === 'rancher-vcluster/rancher-vcluster') {
        const valuesContent = jsyaml.load(this.spec.valuesContent);

        if (!valuesContent.hostname || !valuesContent.bootstrapPassword) {
          this.goToEdit();

          return;
        }
      }

      if (!this.spec.enabled && this.id === HARVESTER_NVIDIA_DRIVER_TOOLKIT) {
        this.$dispatch('promptModal', {
          resources:  [this],
          component:  'HarvesterEnableNvidiaDriverToolkit',
        });

        return;
      }

      if (!this.spec.enabled && this.id === RANCHER_K3K) {
        this.$dispatch('promptModal', {
          resources: [this],
          component: 'HarvesterEnableK3k',
        });

        return;
      }

      this.spec.enabled = !this.spec.enabled;
      await this.save();
    } catch (err) {
      this.spec.enabled = enableHistory;
      this.$dispatch('growl/fromError', {
        title: this.t('harvester.addons.switchFailed', { action: enableHistory ? this.t('generic.disable') : this.t('generic.enable'), name: (this.metadata.name) }),
        err,
      }, { root: true });
    }
  }

  goToRancher() {
    window.open(
      this.rancherHostname,
      '_blank',
    );
  }

  get rancherHostname() {
    const valuesContent = jsyaml.load(this.spec.valuesContent) || {};

    // rancher-k3k nests the hostname under `rancher`, rancher-vcluster keeps it at the top level
    const hostname = this.id === RANCHER_K3K ? valuesContent.rancher?.hostname : valuesContent.hostname;

    return `https://${ hostname }`;
  }

  get stateColor() {
    const state = this.stateDisplay;

    if (state?.toLowerCase().includes('enabled') || state?.toLowerCase().includes('success')) {
      return 'text-success';
    } else if (state === 'Disabled') {
      return 'text-darker';
    } else if (state?.toLowerCase().includes('ing')) {
      return 'text-info';
    } else if (state?.toLowerCase().includes('failed') || state?.toLowerCase().includes('error')) {
      return 'text-error';
    } else {
      return 'text-info';
    }
  }

  get stateDisplay() {
    const out = this?.status?.status;

    if (!out) {
      return 'Disabled';
    }

    if (out.startsWith('Addon')) {
      return startCase(out.replace('Addon', ''));
    }

    return out;
  }

  get stateDescription() {
    const failedCondition = (this.status?.conditions || []).find((C) => C.type === 'OperationFailed');

    return failedCondition?.message || super.stateDescription;
  }

  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.ADD_ONS }"`, { count: 1 })?.trim();
  }

  get displayName() {
    const isExperimental = this.metadata?.labels?.[HCI_ANNOTATIONS.ADDON_EXPERIMENTAL] === 'true';
    const name = this.metadata?.labels?.[HCI_ANNOTATIONS.ADDON_DISPLAYNAME] || this.metadata.name;

    return isExperimental ? `${ name } (${ this.t('generic.experimental') })` : name;
  }

  get customValidationRules() {
    let rules = [];

    if (this.metadata.name === 'rancher-monitoring') {
      rules = [
        {
          nullable:   false,
          path:       'spec.valuesContent',
          validators: ['rancherMonitoring'],
        },
      ];
    }

    if (this.metadata.name === 'rancher-logging') {
      rules = [
        {
          nullable:   false,
          path:       'spec.valuesContent',
          validators: ['rancherLogging'],
        },
      ];
    }

    return rules;
  }
}
