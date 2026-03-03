import { load } from 'js-yaml';
import { omitBy, pickBy } from 'lodash';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import { POD, NODE, PVC } from '@shell/config/types';
import { findBy } from '@shell/utils/array';
import { parseSi } from '@shell/utils/units';
import { get, set } from '@shell/utils/object';
import { LABELS_TO_IGNORE_REGEX, HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { _CLONE } from '@shell/config/query-params';
import { matchesSomeRegex } from '@shell/utils/string';
import { parseVolumeClaimTemplates } from '@pkg/utils/vm';
import { BACKUP_TYPE } from '../config/types';
import { HCI } from '../types';
import HarvesterResource from './harvester';
import { getVmCPUMemoryValues } from '../utils/cpuMemory';
import { isBackupTargetSettingUnavailable } from '../utils/setting';

export const OFF = 'Off';

const VMI_WAITING_MESSAGE =
  'The virtual machine is waiting for resources to become available.';
const VM_ERROR = 'VM error';
const STOPPING = 'Stopping';
const UNSCHEDULABLE = 'Unschedulable';
const WAITING = 'Waiting';
const NOT_READY = 'Not Ready';
const AGENT_CONNECTED = 'AgentConnected';

const PAUSED = 'Paused';
const PAUSED_VM_MODAL_MESSAGE =
  'This VM has been paused. If you wish to unpause it, please click the Unpause button below. For further details, please check with your system administrator.';

const POD_STATUS_NOT_SCHEDULABLE = 'POD_NOT_SCHEDULABLE';
const POD_STATUS_CONTAINER_FAILING = 'POD_CONTAINER_FAILING';

const POD_STATUS_FAILED = 'POD_FAILED';
const POD_STATUS_CRASHLOOP_BACKOFF = 'POD_CRASHLOOP_BACKOFF';
const POD_STATUS_UNKNOWN = 'POD_STATUS_UNKNOWN';

const POD_STATUS_ALL_ERROR = [
  POD_STATUS_NOT_SCHEDULABLE,
  POD_STATUS_CONTAINER_FAILING,
  POD_STATUS_FAILED,
  POD_STATUS_CRASHLOOP_BACKOFF,
  POD_STATUS_UNKNOWN
];

const POD_STATUS_COMPLETED = 'POD_STATUS_COMPLETED';
const POD_STATUS_SUCCEEDED = 'POD_STATUS_SUCCEEDED';
const POD_STATUS_RUNNING = 'POD_STATUS_RUNNING';

const POD_STATUS_ALL_READY = [
  POD_STATUS_RUNNING,
  POD_STATUS_COMPLETED,
  POD_STATUS_SUCCEEDED
];

const RunStrategy = {
  Always:         'Always',
  RerunOnFailure: 'RerunOnFailure',
  Halted:         'Halted',
  Manual:         'Manual'
};

const StateChangeRequest = {
  Start: 'Start',
  Stop:  'Stop'
};

const STARTING_MESSAGE =
  'This virtual machine will start shortly. Preparing storage, networking, and compute resources.';

const VMIPhase = {
  Pending:    'Pending',
  Scheduling: 'Scheduling',
  Scheduled:  'Scheduled',
  Running:    'Running',
  Succeeded:  'Succeeded',
  Failed:     'Failed',
  Unknown:    'Unknown'
};

let productInStore;

const IgnoreMessages = ['pod has unbound immediate PersistentVolumeClaims'];

export default class VirtVm extends HarvesterResource {
  get availableActions() {
    const out = super._availableActions;
    const clone = out.find((action) => action.action === 'goToClone');

    if (clone) {
      clone.action = 'goToCloneVM';
    }

    return [
      {
        action:     'stopVM',
        altAction:  'altStopVM',
        enabled:    !!this.actions?.stop,
        icon:       'icon icon-close',
        label:      this.t('harvester.action.stop'),
        bulkable:   true,
        bulkAction: 'stopVM',
      },
      {
        action:   'forceStop',
        enabled:  !!this.actions?.forceStop,
        icon:     'icon icon-close',
        label:    this.t('harvester.action.forceStop'),
        bulkable: true
      },
      {
        action:    'pauseVM',
        altAction: 'altPauseVM',
        enabled:   !!this.actions?.pause,
        icon:      'icon icon-pause',
        label:     this.t('harvester.action.pause')
      },
      {
        action:  'unpauseVM',
        enabled: !!this.actions?.unpause,
        icon:    'icon icon-spinner',
        label:   this.t('harvester.action.unpause')
      },
      {
        action:     'restartVM',
        enabled:    !!this.actions?.restart,
        icon:       'icon icon-refresh',
        label:      this.t('harvester.action.restart'),
        bulkable:   true,
        bulkAction: 'restartVM'
      },
      {
        action:  'softrebootVM',
        enabled: !!this.actions?.softreboot,
        icon:    'icon icon-pipeline',
        label:   this.t('harvester.action.softreboot')
      },
      {
        action:   'startVM',
        enabled:  !!this.actions?.start,
        icon:     'icon icon-play',
        label:    this.t('harvester.action.start'),
        bulkable: true
      },
      {
        action:  'backupVM',
        enabled: !!this.actions?.backup && !this.isBackupTargetUnavailable,
        icon:    'icon icon-backup',
        label:   this.t('harvester.action.backup')
      },
      {
        action:  'takeVMSnapshot',
        enabled: (!!this.actions?.snapshot || !!this.actions?.backup),
        icon:    'icon icon-snapshot',
        label:   this.t('harvester.action.vmSnapshot')
      },
      {
        action:  'editVMQuota',
        enabled: !!this.actions?.updateResourceQuota && !!this.actions.deleteResourceQuota,
        icon:    'icon icon-storage',
        label:   this.t('harvester.action.editVMQuota')
      },
      {
        action:  'cpuMemoryHotplug',
        enabled: !!this.actions?.cpuAndMemoryHotplug,
        icon:    'icon icon-os-management',
        label:   this.t('harvester.action.cpuAndMemoryHotplug')
      },
      {
        action:  'createSchedule',
        enabled: this.schedulingVMBackupFeatureEnabled,
        icon:    'icon icon-history',
        label:   this.t('harvester.action.createSchedule')
      },
      {
        action:  'restoreVM',
        enabled: !!this.actions?.restore,
        icon:    'icon icon-backup-restore',
        label:   this.t('harvester.action.restore')
      },
      {
        action:  'ejectCDROM',
        enabled: !this.hotplugCdRomEnabled && !!this.actions?.ejectCdRom,
        icon:    'icon icon-delete',
        label:   this.t('harvester.action.ejectCDROM')
      },
      {
        action:  'migrateVM',
        enabled: !!this.actions?.migrate,
        icon:    'icon icon-copy',
        label:   this.t('harvester.action.migrate')
      },
      {
        action:  'abortMigrationVM',
        enabled: !!this.actions?.abortMigration,
        icon:    'icon icon-close',
        label:   this.t('harvester.action.abortMigration')
      },
      {
        action:  'addHotplugVolume',
        enabled: !!this.actions?.addVolume,
        icon:    'icon icon-plus',
        label:   this.t('harvester.action.addHotplugVolume')
      },
      {
        action:  'addHotplugNic',
        enabled: this.hotplugNicFeatureEnabled && !!this.actions?.addNic,
        icon:    'icon icon-plus',
        label:   this.t('harvester.action.addHotplugNic')
      },
      {
        action:  'createTemplate',
        enabled: !!this.actions?.createTemplate,
        icon:    'icon icon-copy',
        label:   this.t('harvester.action.createTemplate')
      },
      {
        action:  'openLogs',
        enabled: !!this.podResource,
        icon:    'icon icon-fw icon-chevron-right',
        label:   this.t('harvester.action.viewlogs'),
        total:   1
      },
      ...out
    ];
  }

  get productInStore() {
    if (!productInStore) {
      productInStore = this.$rootGetters['currentProduct'].inStore;
    }

    return productInStore;
  }

  applyDefaults(resources = this, realMode) {
    const spec = {
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
              inputs: [
                {
                  bus:  'usb',
                  name: 'tablet',
                  type: 'tablet'
                }
              ],
              interfaces: [
                {
                  masquerade: {},
                  model:      'virtio',
                  name:       'default'
                }
              ],
              disks: []
            },
            resources: {
              limits: {
                memory: null,
                cpu:    ''
              }
            },
            features: { acpi: { enabled: true } }
          },
          evictionStrategy: 'LiveMigrateIfPossible',
          hostname:         '',
          networks:         [
            {
              name: 'default',
              pod:  {}
            }
          ],
          volumes:  [],
          affinity: {},
        }
      }
    };

    if (realMode !== _CLONE) {
      this.metadata['annotations'] = { [HCI_ANNOTATIONS.VOLUME_CLAIM_TEMPLATE]: '[]' };
      this.metadata['labels'] = {};
      this['spec'] = spec;
    }
  }

  cleanForNew() {
    this.$dispatch(`cleanForNew`, this);

    this.spec.template.spec.hostname = '';
    const interfaces = this.spec.template.spec.domain.devices?.interfaces || [];

    for (let i = 0; i < interfaces.length; i++) {
      if (interfaces[i].macAddress) {
        interfaces[i].macAddress = '';
      }
    }

    // delete, spec?.dataSource:  The original data should not be saved when clone template
    const deleteDataSource = this.volumeClaimTemplates.map((volume) => {
      if (volume?.spec?.dataSource) {
        delete volume.spec.dataSource;
      }

      return volume;
    });

    this.metadata.annotations[HCI_ANNOTATIONS.VOLUME_CLAIM_TEMPLATE] = JSON.stringify(deleteDataSource);
  }

  restartVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      action:            'restart',
      warningMessageKey: 'dialog.confirmExecution.restart.message',
      component:         'ConfirmExecutionDialog'
    });
  }

  doSoftReboot() {
    this.doActionGrowl('softreboot', {});
  }

  softrebootVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      action:            'softreboot',
      warningMessageKey: 'dialog.confirmExecution.softreboot.message',
      component:         'ConfirmExecutionDialog'
    });
  }

  openLogs() {
    this.$dispatch(
      'wm/open',
      {
        id:        `${ this.id }-logs`,
        label:     this.nameDisplay,
        icon:      'file',
        component: 'ContainerLogs',
        attrs:     {
          pod:              this.podResource,
          initialContainer: this.podResource.metadata.annotations['kubectl.kubernetes.io/default-container']
        }
      },
      { root: true }
    );
  }

  createSchedule(resources = this) {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.SCHEDULE_VM_BACKUP },
      query:  { vmNamespace: this.metadata.namespace, vmName: this.metadata.name }
    });
  }

  backupVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterBackupModal'
    });
  }

  takeVMSnapshot(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterVMSnapshotDialog'
    });
  }

  editVMQuota(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      snapshotSizeQuota: this.snapshotSizeQuota,
      component:         'HarvesterQuotaDialog'
    });
  }

  unplugVolume(diskName) {
    const resources = this;

    this.$dispatch('promptModal', {
      resources,
      name:      diskName,
      type:      'volume',
      component:  'HarvesterHotUnplug',
    });
  }

  ejectCdRomVolume(diskName) {
    const resources = this;

    this.$dispatch('promptModal', {
      resources,
      name:      diskName,
      type:      'cdrom',
      component: 'HarvesterHotUnplug',
    });
  }

  unplugNIC(networkName) {
    const resources = this;

    this.$dispatch('promptModal', {
      resources,
      name:      networkName,
      type:      'network',
      component: 'HarvesterHotUnplug',
    });
  }

  restoreVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterRestoreDialog'
    });
  }

  get machineType() {
    return this.spec?.template?.spec?.domain?.machine?.type || '';
  }

  get realAttachNodeName() {
    const vmi = this.$getters['byId'](HCI.VMI, this.id);
    const nodeName = vmi?.status?.nodeName;
    const node = this.$getters['byId'](NODE, nodeName);

    return node?.nameDisplay || '';
  }

  get nodeName() {
    const vmi = this.$getters['byId'](HCI.VMI, this.id);
    const nodeName = vmi?.status?.nodeName;
    const node = this.$getters['byId'](NODE, nodeName);

    return node?.id;
  }

  pauseVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      action:            'pause',
      warningMessageKey: 'dialog.confirmExecution.pause.message',
      component:         'ConfirmExecutionDialog'
    });
  }

  altPauseVM() {
    this.doActionGrowl('pause', {});
  }

  goToCloneVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'CloneVmDialog'
    });
  }

  unpauseVM() {
    this.doActionGrowl('unpause', {});
  }

  stopVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      action:            'stop',
      warningMessageKey: 'dialog.confirmExecution.stop.message',
      component:         'ConfirmExecutionDialog'
    });
  }

  altStopVM() {
    this.doActionGrowl('stop', {});
  }

  forceStop() {
    this.doActionGrowl('forceStop', {});
  }

  startVM() {
    this.doActionGrowl('start', {});
  }

  migrateVM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterMigrationDialog'
    });
  }

  ejectCDROM(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterEjectCDROMDialog'
    });
  }

  cpuMemoryHotplug(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterCPUMemoryHotPlugDialog'
    });
  }

  abortMigrationVM() {
    this.doActionGrowl('abortMigration', {});
  }

  createTemplate(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterCloneTemplate'
    });
  }

  addHotplugVolume(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterAddHotplugVolumeModal'
    });
  }

  insertCdRomVolume(diskName) {
    const resources = this;

    this.$dispatch('promptModal', {
      resources,
      name:      diskName,
      component:  'HarvesterInsertCdRomVolume',
    });
  }

  addHotplugNic(resources = this) {
    this.$dispatch('promptModal', {
      resources,
      component: 'HarvesterAddHotplugNic'
    });
  }

  get networksName() {
    const interfaces = this.spec.template.spec.domain.devices?.interfaces || [];

    return interfaces.map((I) => I.name);
  }

  get isOff() {
    return !this.isVMExpectedRunning ? { status: OFF } : null;
  }

  get isWaitingForVMI() {
    if (this && this.isVMExpectedRunning && !this.isVMCreated) {
      return { status: WAITING, message: VMI_WAITING_MESSAGE };
    }

    return null;
  }

  get cpuPinningFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('cpuPinning');
  }

  get isCpuPinning() {
    return this.spec?.template?.spec?.domain?.cpu?.dedicatedCpuPlacement === true;
  }

  get isVMExpectedRunning() {
    if (!this?.spec) {
      return false;
    }
    const { running = null, runStrategy = null } = this.spec;
    const conditions = this?.status?.conditions || [];

    if (running) {
      return true;
    }

    if (runStrategy !== null) {
      let changeRequests;

      switch (runStrategy) {
      case RunStrategy.Halted:
        return false;
      case RunStrategy.Always:
        return true;
      case RunStrategy.RerunOnFailure:
        if (
          this.status?.printableStatus === 'ErrorUnschedulable' &&
            conditions.find(
              (C) => C.message && C.message.includes(IgnoreMessages)
            )
        ) {
          return true;
        }

        return ['Starting', 'Running'].includes(this.status?.printableStatus);
      case RunStrategy.Manual:
      default:
        changeRequests = new Set(
          (this.status?.stateChangeRequests || []).map(
            (chRequest) => chRequest?.action
          )
        );

        if (changeRequests.has(StateChangeRequest.Stop)) {
          return false;
        }
        if (changeRequests.has(StateChangeRequest.Start)) {
          return true;
        }

        if (changeRequests.size === 0) {
          return ['Starting', 'Running'].includes(
            this.status?.printableStatus
          );
        }

        return this.isVMCreated; // if there is no change request we can assume created is representing running (current and expected)
      }
    }

    return false;
  }

  get podResource() {
    const inStore = this.productInStore;

    const vmiResource = this.$rootGetters[`${ inStore }/byId`](HCI.VMI, this.id);
    const podList = this.$rootGetters[`${ inStore }/all`](POD);

    return podList.find((P) => {
      return (
        vmiResource?.metadata?.name &&
        vmiResource?.metadata?.name === P.metadata?.ownerReferences?.[0].name
      );
    });
  }

  get isPaused() {
    const conditions = this.vmi?.status?.conditions || [];
    const isPause = conditions.filter((cond) => cond.type === PAUSED).length > 0;

    return isPause ? {
      status:  PAUSED,
      message: PAUSED_VM_MODAL_MESSAGE
    } : null;
  }

  get isVMError() {
    const conditions = get(this, 'status.conditions');
    const vmFailureCond = findBy(conditions, 'type', 'Failure');

    if (vmFailureCond) {
      return {
        status:          VM_ERROR,
        detailedMessage: vmFailureCond.message
      };
    }

    return null;
  }

  get nsResourceQuota() {
    const inStore = this.productInStore;
    const allResQuotas = this.$rootGetters[`${ inStore }/all`](HCI.RESOURCE_QUOTA);

    return allResQuotas.find( (RQ) => RQ.namespace === this.metadata.namespace);
  }

  get snapshotSizeQuota() {
    return this.nsResourceQuota?.spec?.snapshotLimit?.vmTotalSnapshotSizeQuota?.[this.metadata.name];
  }

  get vmi() {
    const inStore = this.productInStore;

    const vmis = this.$rootGetters[`${ inStore }/all`](HCI.VMI);

    return vmis.find((VMI) => VMI.id === this.id);
  }

  get volumes() {
    const pvcs = this.$rootGetters[`${ this.productInStore }/all`](PVC);

    const volumeClaimNames = this.spec.template.spec.volumes?.map((v) => v.persistentVolumeClaim?.claimName).filter((v) => !!v) || [];

    return pvcs.filter((pvc) => volumeClaimNames.includes(pvc.metadata.name));
  }

  get lvmVolumes() {
    return this.volumes.filter((volume) => volume?.isLvm);
  }

  get longhornV2Volumes() {
    return this.volumes.filter((volume) => volume?.isLonghornV2);
  }

  get encryptedVolumeType() {
    if (!this.volumes || this.volumes.length === 0) {
      return 'none';
    }

    if (this.volumes.every((vol) => vol.isEncrypted)) {
      return 'all';
    } else if (this.volumes.some((vol) => vol.isEncrypted)) {
      return 'partial';
    } else {
      return 'none';
    }
  }

  get isError() {
    const conditions = get(this.vmi, 'status.conditions');
    const vmiFailureCond = findBy(conditions, 'type', 'Failure');

    if (vmiFailureCond) {
      return { status: 'VMI error', detailedMessage: vmiFailureCond.message };
    }

    if ((this.vmi || this.isVMCreated) && this.podResource) {
      // const podStatus = this.podResource.getPodStatus;
      // if (POD_STATUS_ALL_ERROR.includes(podStatus?.status)) {
      //   return {
      //     ...podStatus,
      //     status: 'LAUNCHER_POD_ERROR',
      //     pod:    this.podResource,
      //   };
      // }
    }

    return this?.vmi?.status?.phase;
  }

  get isRunning() {
    const conditions = get(this.vmi, 'status.conditions');
    const isVMIReady = findBy(conditions, 'type', 'Ready')?.status === 'True';

    if (this.vmi?.status?.phase === VMIPhase.Running && isVMIReady) {
      return { status: VMIPhase.Running };
    }

    return null;
  }

  get isNotReady() {
    const conditions = get(this.vmi, 'status.conditions');
    const VMIReadyCondition = findBy(conditions, 'type', 'Ready');

    if (
      VMIReadyCondition?.status === 'False' &&
      this.vmi?.status?.phase === VMIPhase.Running
    ) {
      return { status: NOT_READY };
    }

    return null;
  }

  get isPending() {
    if (this &&
      !this.isVMExpectedRunning &&
      this.isVMCreated &&
      this.vmi?.status?.phase === VMIPhase.Pending
    ) {
      return { status: VMIPhase.Pending };
    }

    return null;
  }

  get isStopping() {
    if (this &&
      !this.isVMExpectedRunning &&
      this.isVMCreated &&
      this.vmi?.status?.phase !== undefined &&
      this.vmi?.status?.phase !== VMIPhase.Succeeded &&
      this.vmi?.status?.phase !== VMIPhase.Pending
    ) {
      return { status: STOPPING };
    }

    return null;
  }

  get isStarting() {
    if (this.isVMExpectedRunning && this.isVMCreated) {
      // created but not yet ready
      if (this.podResource) {
        const podStatus = this.podResource.getPodStatus;

        if (!POD_STATUS_ALL_READY.includes(podStatus?.status)) {
          return {
            ...podStatus,
            status:          'Starting',
            message:         STARTING_MESSAGE,
            detailedMessage: podStatus?.message,
            pod:             this.podResource
          };
        }
      }

      return {
        status:  'Starting',
        message: STARTING_MESSAGE,
        pod:     this.podResource
      };
    }

    return null;
  }

  get isUnschedulable() {
    if (this.isStopping || this.isStarting) {
      const condition = this.status?.conditions?.find((c) => c.reason === UNSCHEDULABLE);

      if (!!condition) {
        return {
          status:  UNSCHEDULABLE,
          message: condition.message || 'VM is unschedulable',
        };
      }
    }

    return null;
  }

  get isTerminating() {
    return !!this?.metadata?.deletionTimestamp;
  }

  get otherState() {
    const state = (this.vmi &&
      [VMIPhase.Scheduling, VMIPhase.Scheduled].includes(
        this.vmi?.status?.phase
      ) && {
      status:  'Starting',
      message: STARTING_MESSAGE
    }) ||
      (this.vmi &&
        this.vmi.status?.phase === VMIPhase.Pending && {
        status:  'VMI_WAITING',
        message: VMI_WAITING_MESSAGE
      }) ||
      (this.vmi &&
        this.vmi?.status?.phase === VMIPhase.Failed && { status: 'VMI_ERROR' }) ||
      (this.isVMExpectedRunning &&
        !this.isVMCreated && { status: 'Pending' }) || { status: 'UNKNOWN' };

    return state;
  }

  get isVMCreated() {
    return !!this?.status?.created;
  }

  get getDataVolumeTemplates() {
    return get(this, 'spec.volumeClaimTemplates') === null ? [] : this.spec.volumeClaimTemplates;
  }

  get restoreResource() {
    const id = `${ this.metadata.namespace }/${ get(
      this,
      `metadata.annotations."${ HCI_ANNOTATIONS.RESTORE_NAME }"`
    ) }`;

    const inStore = this.productInStore;

    const allRestore = this.$rootGetters[`${ inStore }/all`](HCI.RESTORE);

    const res = allRestore.find((O) => O.id === id);

    if (res) {
      const allBackups = this.$rootGetters[`${ inStore }/all`](HCI.BACKUP);

      res.fromSnapshot = !!allBackups
        .filter((b) => b.spec?.type !== BACKUP_TYPE.BACKUP)
        .find((s) => s.id === `${ res.spec?.virtualMachineBackupNamespace }/${ res.spec?.virtualMachineBackupName }`);
    }

    return res;
  }

  get restoreProgress() {
    if (this.isVMError || this.isTerminating) {
      return {};
    }

    const status = this.restoreResource?.status;

    if (status !== undefined) {
      return {
        type:       'restore',
        percentage: status?.progress || 0,
        details:    { volumes: status?.restores || [] }
      };
    }

    return {};
  }

  get restoreState() {
    if (!this.restoreResource) {
      return true;
    }

    return this.restoreResource?.isComplete;
  }

  get actualState() {
    if (!this.restoreState) {
      return 'Restoring';
    }

    if (this.isTerminating) {
      return 'Terminating';
    }

    if (
      !!this?.vmi?.migrationState &&
      this.vmi.migrationState.status !== 'Failed'
    ) {
      return this.vmi.migrationState.status;
    }

    const state =
      this.isUnschedulable?.status ||
      this.isPaused?.status ||
      this.isVMError?.status ||
      this.isPending?.status ||
      this.isStopping?.status ||
      this.isOff?.status ||
      this.isError?.status ||
      this.isRunning?.status ||
      this.isNotReady?.status ||
      this.isStarting?.status ||
      this.isWaitingForVMI?.state ||
      this.otherState?.status;

    return state;
  }

  get warningMessage() {
    if (this.metadata?.annotations[HCI_ANNOTATIONS.VM_INSUFFICIENT]) {
      return {
        message:    this.metadata?.annotations[HCI_ANNOTATIONS.VM_INSUFFICIENT],
        canDismiss: true,
      };
    }

    const conditions = get(this, 'status.conditions');
    const vmFailureCond = findBy(conditions, 'type', 'Failure');

    if (vmFailureCond) {
      return {
        status:  VM_ERROR,
        message: vmFailureCond.message
      };
    }

    const vmiConditions = get(this.vmi, 'status.conditions');
    const vmiFailureCond = findBy(vmiConditions, 'type', 'Failure');

    if (vmiFailureCond) {
      return { status: 'VMI error', detailedMessage: vmiFailureCond.message };
    }

    if ((this.vmi || this.isVMCreated) && this.podResource) {
      const podStatus = this.podResource.getPodStatus;

      if (POD_STATUS_ALL_ERROR.includes(podStatus?.status)) {
        return {
          ...podStatus,
          status: 'LAUNCHER_POD_ERROR',
          pod:    this.podResource
        };
      }
    }

    return null;
  }

  get migrationMessage() {
    if (
      !!this?.vmi?.migrationState &&
      this.vmi.migrationState.status === 'Failed'
    ) {
      return {
        ...this.actualState,
        message: this.t('harvester.modal.migration.failedMessage')
      };
    }

    return null;
  }

  get stateDisplay() {
    return this.actualState;
  }

  get stateColor() {
    const state = this.actualState;

    return colorForState(state);
  }

  get networkIps() {
    let networkData = '';
    const out = [];
    const arrVolumes = this.spec.template?.spec?.volumes || [];

    arrVolumes.forEach((V) => {
      if (V.cloudInitNoCloud) {
        networkData = V.cloudInitNoCloud.networkData;
      }
    });

    try {
      const newInitScript = load(networkData);

      if (newInitScript?.config && Array.isArray(newInitScript.config)) {
        const config = newInitScript.config;

        config.forEach((O) => {
          if (O?.subnets && Array.isArray(O.subnets)) {
            const subnets = O.subnets;

            subnets.forEach((S) => {
              if (S.address) {
                out.push(S.address);
              }
            });
          }
        });
      }
    } catch (err) {}

    return out;
  }

  get warningCount() {
    return this.resourcesStatus.warningCount;
  }

  get errorCount() {
    return this.resourcesStatus.errorCount;
  }

  get resourcesStatus() {
    const inStore = this.productInStore;
    const vmList = this.$rootGetters[`${ inStore }/all`](HCI.VM);
    let warningCount = 0;
    let errorCount = 0;

    vmList.forEach((vm) => {
      const status = vm.actualState;

      if (status === VM_ERROR) {
        errorCount += 1;
      } else if (
        status === 'Stopping' ||
        status === 'Waiting' ||
        status === 'Pending' ||
        status === 'Starting' ||
        status === 'Terminating'
      ) {
        warningCount += 1;
      }
    });

    return {
      warningCount,
      errorCount
    };
  }

  get volumeClaimTemplates() {
    return parseVolumeClaimTemplates(this);
  }

  get persistentVolumeClaimName() {
    const volumes = this.spec.template.spec.volumes || [];

    return volumes
      .map((O) => {
        return O?.persistentVolumeClaim?.claimName;
      })
      .filter((name) => !!name);
  }

  get rootImageId() {
    let imageId = '';
    const inStore = this.productInStore;
    const pvcs = this.$rootGetters[`${ inStore }/all`](PVC) || [];

    const volumes = this.spec.template.spec.volumes || [];

    const firstVolumeName = volumes[0]?.persistentVolumeClaim?.claimName;
    const isNoExistingVolume = this.volumeClaimTemplates.find((volume) => {
      return firstVolumeName === volume?.metadata?.name;
    });

    if (!isNoExistingVolume) {
      const existingVolume = pvcs.find(
        (P) => P.id === `${ this.metadata.namespace }/${ firstVolumeName }`
      );

      if (existingVolume) {
        return existingVolume?.metadata?.annotations?.[
          'harvesterhci.io/imageId'
        ];
      }
    }

    this.volumeClaimTemplates.find((volume) => {
      imageId = volume?.metadata?.annotations?.['harvesterhci.io/imageId'];

      return !!imageId;
    });

    return imageId;
  }

  get restoreName() {
    return (
      get(this, `metadata.annotations."${ HCI_ANNOTATIONS.RESTORE_NAME }"`) || ''
    );
  }

  get customValidationRules() {
    const rules = [
      {
        nullable:       false,
        path:           'metadata.name',
        required:       true,
        minLength:      1,
        maxLength:      63,
        translationKey: 'harvester.fields.name'
      },
      {
        nullable:   false,
        path:       'spec.template.spec',
        validators: ['vmNetworks']
      },
      {
        nullable:   false,
        path:       'spec',
        validators: [`vmDisks`]
      }
    ];

    return rules;
  }

  get attachNetwork() {
    const networks = this.spec?.template?.spec?.networks || [];
    const hasMultus = networks.find((N) => N.multus);

    return !!hasMultus;
  }

  get memorySort() {
    const memory = getVmCPUMemoryValues(this).memory;

    const formatSize = parseSi(memory);

    return parseInt(formatSize, 10);
  }

  get ingoreVMMessage() {
    const ignoreConditions = [
      {
        name:    'unavailable',
        error:   false,
        vmState: this.actualState === PAUSED
      }
    ];

    const state = this.metadata?.state;

    return (
      ignoreConditions.find(
        (condition) => condition.name === state?.name &&
          condition.error === state?.error &&
          condition.vmState
      ) ||
      IgnoreMessages.find((M) => super.stateDescription?.includes(M)) ||
      this.isOff
    );
  }

  get isRestartRequired() {
    const conditions = get(this, 'status.conditions');
    const restartRequired = findBy(conditions, 'type', 'RestartRequired');

    return restartRequired && restartRequired.status === 'True';
  }

  get stateDescription() {
    if (this.isRestartRequired) {
      return this.t('harvester.virtualMachine.hotplug.restartVMMessage');
    }

    const restoreConditions = this.restoreResource?.status?.conditions || [];
    const restoreError = restoreConditions.find((s) => s.error === true && s.reason === 'Error' && s.type === 'Ready');

    if (restoreError?.message) {
      return restoreError.message;
    }

    return this.ingoreVMMessage ? '' : super.stateDescription;
  }

  get displayCPU() {
    return getVmCPUMemoryValues(this).cpu;
  }

  get displayMemory() {
    return getVmCPUMemoryValues(this).memory;
  }

  get isQemuInstalled() {
    const conditions = this.vmi?.status?.conditions || [];
    const qemu = conditions.find((cond) => cond.type === AGENT_CONNECTED);

    return qemu?.status === 'True';
  }

  get instanceLabels() {
    const all = this.spec?.template?.metadata?.labels || {};

    return omitBy(all, (value, key) => {
      return matchesSomeRegex(key, LABELS_TO_IGNORE_REGEX);
    });
  }

  get hostDevices() {
    return this.spec?.template?.spec?.domain?.devices?.hostDevices || [];
  }

  get provisionedVGpus() {
    try {
      const deviceAllocationDetails = JSON.parse(this.metadata?.annotations[HCI_ANNOTATIONS.VM_DEVICE_ALLOCATION_DETAILS] || '{}');

      return deviceAllocationDetails?.gpus || {};
    } catch (error) {
      return {};
    }
  }

  get schedulingVMBackupFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('schedulingVMBackup');
  }

  get volumeEncryptionFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('volumeEncryption');
  }

  get tpmPersistentStateFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('tpmPersistentState');
  }

  get efiPersistentStateFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('efiPersistentState');
  }

  get thirdPartyStorageFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('thirdPartyStorage');
  }

  get vmMachineTypeAutoFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('vmMachineTypeAuto');
  }

  get hotplugNicFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('hotplugNic');
  }

  get hotplugCdRomEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('hotplugCdRom');
  }

  get isBackupTargetUnavailable() {
    const allSettings = this.$rootGetters['harvester/all'](HCI.SETTING) || [];
    const backupTargetSetting = allSettings.find( (O) => O.id === 'backup-target');

    return isBackupTargetSettingUnavailable(backupTargetSetting);
  }

  setInstanceLabels(val) {
    if ( !this.spec?.template?.metadata?.labels ) {
      set(this, 'spec.template.metadata.labels', {});
    }

    const all = this.spec.template.metadata.labels || {};
    const wasIgnored = pickBy(all, (value, key) => {
      return matchesSomeRegex(key, LABELS_TO_IGNORE_REGEX);
    });

    this.spec.template.metadata['labels'] = { ...wasIgnored, ...val };
  }
}
