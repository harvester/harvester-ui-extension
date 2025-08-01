import { get, clone } from '@shell/utils/object';
import { findBy } from '@shell/utils/array';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { _CREATE } from '@shell/config/query-params';
import { HCI } from '../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import { BACKUP_TYPE } from '../config/types';
import HarvesterResource from './harvester';

export default class HciVmBackup extends HarvesterResource {
  detailPageHeaderActionOverride(realMode) {
    const route = this.currentRoute();

    if (realMode === _CREATE) {
      return route.params.resource === HCI.BACKUP ? this.t('harvester.backup.title') : this.t('harvester.vmSnapshot.title');
    }
  }

  get detailLocation() {
    const detailLocation = clone(this._detailLocation);

    detailLocation.params.resource = HCI.BACKUP;

    return detailLocation;
  }

  get disableResourceDetailDrawerConfigTab() {
    return true;
  }

  get doneOverride() {
    const route = this.currentRoute();
    const detailLocation = clone(this._detailLocation);

    delete detailLocation.params.namespace;
    delete detailLocation.params.id;
    detailLocation.params.resource = route.params.resource;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource`;

    return detailLocation;
  }

  get parentNameOverride() {
    const route = this.currentRoute();

    return this.$rootGetters['i18n/t'](`typeLabel."${ route.params.resource }"`, { count: 1 })?.trim();
  }

  get parentLocationOverride() {
    return this.doneOverride;
  }

  get _availableActions() {
    const toFilter = ['goToEdit', 'cloneYaml', 'goToClone', 'download'];

    const out = super._availableActions.filter((action) => {
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
        action:  'restoreExistingVM',
        enabled: canCreateVM && this.attachVmExisting && this?.status?.readyToUse,
        icon:    'icons icon-refresh',
        label:   this.t('harvester.action.restoreExistingVM'),
      },
      {
        action:  'restoreNewVM',
        enabled: canCreateVM && this?.status?.readyToUse,
        icon:    'icons icon-backup',
        label:   this.t('harvester.action.restoreNewVM'),
      },
      ...out
    ];
  }

  restoreExistingVM(resource = this) {
    const router = this.currentRouter();
    const targetResource = resource.spec.type === BACKUP_TYPE.BACKUP ? HCI.BACKUP : HCI.VM_SNAPSHOT;

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: targetResource },
      query:  {
        restoreMode:  'existing',
        resourceName: resource.name,
      }
    });
  }

  restoreNewVM(resource = this) {
    const router = this.currentRouter();
    const targetResource = resource.spec.type === BACKUP_TYPE.BACKUP ? HCI.BACKUP : HCI.VM_SNAPSHOT;

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: targetResource },
      query:  {
        restoreMode:  'new',
        resourceName: resource.name,
      }
    });
  }

  get state() {
    let out = 'Pending';
    const conditions = get(this, 'status.conditions');
    const isProgress = findBy(conditions, 'type', 'InProgress')?.status === 'True';
    const isReady = findBy(conditions, 'type', 'Ready')?.status === 'True';

    if (this?.status?.readyToUse) {
      out = 'Ready';
    } else if (isProgress) {
      out = 'Progressing';
    } else if (!isReady) {
      out = 'error';
    }

    return out;
  }

  get stateColor() {
    const state = this.state;

    return colorForState(state);
  }

  get sourceSchedule() {
    return this.metadata?.annotations?.[HCI_ANNOTATIONS.SVM_BACKUP_ID];
  }

  get attachVM() {
    return this.spec.source.name;
  }

  get backupContentName() {
    return this?.status?.virtualMachineBackupContentName || '';
  }

  get backupProgress() {
    return {
      type:       BACKUP_TYPE.BACKUP,
      percentage: this.status?.progress === undefined && !this.status?.readyToUse ? 0 : this.status?.progress,
      details:    { volumes: this.status?.volumeBackups }
    };
  }

  get backupTarget() {
    return this?.status?.backupTarget?.endpoint || '';
  }

  get attachVmExisting() {
    const vmList = this.$rootGetters['harvester/all'](HCI.VM);

    return !!vmList.find( (V) => V.metadata.name === this.attachVM);
  }

  remove() {
    const opt = { ...arguments };

    opt.params = { propagationPolicy: 'Foreground' };

    return this._remove(opt);
  }
}
