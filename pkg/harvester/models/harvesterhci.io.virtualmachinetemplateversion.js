import { find, pickBy, omitBy } from 'lodash';
import {
  AS, MODE, _VIEW, _CONFIG, _UNFLAG, _EDIT
} from '@shell/config/query-params';
import { LABELS_TO_IGNORE_REGEX, HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { findBy } from '@shell/utils/array';
import { get, set } from '@shell/utils/object';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import { matchesSomeRegex } from '@shell/utils/string';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import { HCI } from '../types';
import HarvesterResource from './harvester';

export default class HciVmTemplateVersion extends HarvesterResource {
  get availableActions() {
    let out = super._availableActions;
    const toFilter = ['goToClone', 'cloneYaml', 'goToViewConfig', 'goToEditYaml', 'goToViewYaml'];

    out = out.filter((action) => {
      if (!toFilter.includes(action.action)) {
        return action;
      }
    });

    const schema = this.$getters['schemaFor'](HCI.VM);
    let canCreateVM = true;

    if ( schema && !schema?.collectionMethods.find((x) => ['post'].includes(x.toLowerCase())) ) {
      canCreateVM = false;
    }

    return [
      {
        action:   'launchFromTemplate',
        icon:     'icon icon-spinner',
        disabled: !canCreateVM || !this.isReady,
        label:    this.t('harvester.action.launchFormTemplate'),
      },
      {
        action:  'cloneTemplate',
        enabled: this.currentTemplate?.canCreate,
        icon:    'icon icon-fw icon-edit',
        label:   this.t('harvester.action.modifyTemplate'),
      },
      {
        action:  'setDefaultVersion',
        enabled: this.currentTemplate?.canCreate,
        icon:    'icon icon-fw icon-checkmark',
        label:   this.t('harvester.action.setDefaultVersion'),
      },
      {
        action: 'goToViewConfig',
        label:  this.t('action.view'),
        icon:   'icon icon-edit',
      },
      ...out
    ];
  }

  applyDefaults() {
    const spec = {
      vm: {
        metadata: { annotations: { [HCI_ANNOTATIONS.VOLUME_CLAIM_TEMPLATE]: '[]' }, labels: {} },
        spec:     {
          runStrategy: 'RerunOnFailure',
          template:    {
            metadata: { annotations: {}, labels: {} },
            spec:     {
              domain: {
                machine: { type: '' },
                cpu:     {
                  cores:   null,
                  sockets: 1,
                  threads: 1
                },
                devices: {
                  inputs: [{
                    bus:  'usb',
                    name: 'tablet',
                    type: 'tablet'
                  }],
                  interfaces: [{
                    masquerade: {},
                    model:      'virtio',
                    name:       'default'
                  }],
                  disks: [],
                },
                resources: {
                  limits: {
                    memory: null,
                    cpu:    ''
                  }
                },
                features: { acpi: { enabled: true } },
              },
              evictionStrategy: 'LiveMigrateIfPossible',
              hostname:         '',
              networks:         [{
                name: 'default',
                pod:  {}
              }],
              volumes:  [],
              affinity: {},
            }
          }
        }
      }
    };

    this['spec'] = spec;
  }

  get canDelete() {
    return this.hasLink('remove') && this.$rootGetters['type-map/optionsFor'](this.type).isRemovable && !this.isDefaultVersion;
  }

  get template() {
    return this.$rootGetters['harvester/all'](HCI.VM_TEMPLATE).find((T) => {
      return T.id === this.spec.templateId;
    });
  }

  get isReady() {
    const conditions = get(this, 'status.conditions');
    const readyCondition = findBy(conditions, 'type', 'ready');

    // Compatibility processing
    return readyCondition ? readyCondition?.status === 'True' : true;
  }

  get stateDisplay() {
    if (this.isReady) {
      return 'Active';
    } else {
      return 'Not Ready';
    }
  }

  get stateColor() {
    const state = this.stateDisplay;

    return colorForState(state);
  }

  get version() {
    return this?.status?.version;
  }

  get templates() {
    return this.$rootGetters['harvester/all'](HCI.VM_TEMPLATE);
  }

  get machineType() {
    return this.vm?.spec?.template?.spec?.domain?.machine?.type || '';
  }

  get templateId() {
    return this.spec.templateId;
  }

  launchFromTemplate() {
    const templateResource = this.currentTemplate;
    const templateId = templateResource.id;
    const launchVersion = this.id;
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.VM },
      query:  { templateId, versionId: launchVersion }
    });
  }

  cloneTemplate(moreQuery = {}) {
    const location = this.detailLocation;

    location.query = {
      ...location.query,
      [MODE]: _EDIT,
      [AS]:   _UNFLAG,
      ...moreQuery
    };

    this.currentRouter().push(location);
  }

  goToViewConfig(moreQuery = {}) {
    const location = this.detailLocation;

    location.query = {
      ...location.query,
      [MODE]:     _VIEW,
      [AS]:       _CONFIG,
      templateId: this.templateId,
      ...moreQuery
    };

    this.currentRouter().push(location);
  }

  get currentTemplate() {
    return find(this.templates, (T) => T.id === this.templateId);
  }

  async setDefaultVersion(moreQuery = {}) {
    const templateResource = this.currentTemplate;

    templateResource.spec.defaultVersionId = this.id;
    await templateResource.save();
  }

  get cpuPinningFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('cpuPinning');
  }

  get defaultVersion() {
    const templates = this.$rootGetters['harvester/all'](HCI.VM_TEMPLATE);
    const template = templates.find((T) => this.templateId === T.id);

    return template?.status?.defaultVersion;
  }

  get isDefaultVersion() {
    return this.defaultVersion === this?.status?.version;
  }

  get customValidationRules() {
    const rules = [
      // {
      //   nullable:       false,
      //   path:           'spec.vm.spec.template.spec.domain.cpu.cores',
      //   min:            1,
      //   max:            100,
      //   required:       true,
      //   translationKey: 'harvester.fields.cpu',
      // },
      // {
      //   nullable:       false,
      //   path:           'spec.vm.spec.template.spec.domain.resources.requests.memory',
      //   required:       false,
      //   translationKey: 'harvester.fields.memory',
      // },
      // {
      //   nullable:       false,
      //   path:           'spec.vm.spec.template.spec',
      //   validators:     ['vmNetworks'],
      // },
      // {
      //   nullable:       false,
      //   path:           'spec.vm.spec',
      //   validators:     ['vmDisks:isVMTemplate'],
      // },
    ];

    return rules;
  }

  get instanceLabels() {
    const all = this.spec?.vm?.spec?.template?.metadata?.labels || {};

    return omitBy(all, (value, key) => {
      return matchesSomeRegex(key, LABELS_TO_IGNORE_REGEX);
    });
  }

  setInstanceLabels(val) {
    if ( !this.spec?.vm?.spec?.template?.metadata?.labels ) {
      set(this, 'spec.vm.spec.template.metadata.labels', {});
    }

    const all = this.spec.vm.spec.template.metadata.labels || {};
    const wasIgnored = pickBy(all, (value, key) => {
      return matchesSomeRegex(key, LABELS_TO_IGNORE_REGEX);
    });

    this.spec.vm.spec.template.metadata['labels'] = { ...wasIgnored, ...val };
  }

  get tpmPersistentStateFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('tpmPersistentState');
  }

  get efiPersistentStateFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('efiPersistentState');
  }

  get systemAnnotations() {
    const annotations = this.annotations || {};

    return Object.keys(annotations).filter((key) => key.includes(HCI_ANNOTATIONS.TEMPLATE_VERSION_CUSTOM_NAME));
  }
}
