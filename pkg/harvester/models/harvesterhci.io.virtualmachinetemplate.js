import { MODE, _CREATE } from '@shell/config/query-params';
import { HCI } from '../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import HarvesterResource from './harvester';
import { clone } from '@shell/utils/object';

export default class HciVmTemplate extends HarvesterResource {
  get availableActions() {
    const toFilter = ['goToEdit', 'cloneYaml', 'goToClone', 'goToEditYaml', 'download'];

    const out = super._availableActions.filter((action) => {
      if (action.altAction === 'remove') {
        action.bulkable = false;
      }

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
        action:  'createFromTemplate',
        enabled: canCreateVM,
        icon:    'icon icon-spinner',
        label:   this.t('harvester.action.createVM'),
      },
      {
        action:  'addVersion',
        enabled: this.canCreate,
        icon:    'icon icon-fw icon-circle-plus',
        label:   this.t('harvester.action.addTemplateVersion'),
      },
      ...out
    ];
  }

  createFromTemplate() {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.VM },
      query:  { templateId: this.id, versionId: this.spec.defaultVersionId }
    });
  }

  get cpuPinningFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('cpuPinning');
  }

  addVersion(moreQuery = {}) {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.VM_VERSION },
      query:  {
        [MODE]:     _CREATE,
        templateId: this.id
      }
    });
  }

  get defaultVersion() {
    return this.status?.defaultVersion;
  }

  get doneOverride() {
    const detailLocation = clone(this.listLocation);

    detailLocation.params.resource = HCI.VM_VERSION;

    return detailLocation;
  }
}
