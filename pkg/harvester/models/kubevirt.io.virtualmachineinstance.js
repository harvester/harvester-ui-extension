import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import { NODE } from '@shell/config/types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { getLatestMigration } from '@pkg/utils/vm';
import { HCI } from '../types';
import HarvesterResource from './harvester';

const PAUSED = 'Paused';
const PAUSED_VM_MODAL_MESSAGE = 'This VM has been paused. If you wish to unpause it, please click the Unpause button below. For further details, please check with your system administrator.';
const VMIPhase = {
  Pending:    'Pending',
  Scheduling: 'Scheduling',
  Scheduled:  'Scheduled',
  Running:    'Running',
  Succeeded:  'Succeeded',
  Failed:     'Failed',
  Unknown:    'Unknown',
};

export default class VirtVmInstance extends HarvesterResource {
  get _availableActions() {
    const out = super._availableActions;

    const actions = out.find((O) => {
      return O.action === 'promptRemove';
    });

    return [actions];
  }

  get stateDisplay() {
    if (this?.metadata?.deletionTimestamp) {
      return 'Terminating';
    }

    return this?.status?.phase;
  }

  get stateBackground() {
    return colorForState(this.stateDisplay).replace('text-', 'bg-');
  }

  get stateColor() {
    const state = this.stateDisplay;

    return colorForState(state);
  }

  // The newest migration of this VMI. Returns an empty array if there is none, as before the index was introduced
  get vmimResource() {
    const all = this.$rootGetters['harvester/all'](HCI.VMIM) || [];

    return getLatestMigration(all, this.metadata?.namespace, this.metadata?.name) || [];
  }

  get migrationState() {
    const state = this.metadata?.annotations?.[HCI_ANNOTATIONS.MIGRATION_STATE];
    const migration = this.vmimResource;

    if (migration?.status?.phase === VMIPhase.Failed) {
      return {
        type:   'migration',
        status: VMIPhase.Failed
      };
    }

    if (migration?.status?.phase && state) {
      return {
        type:   'migration',
        status: state
      };
    }

    return null;
  }

  get migrationStateBackground() {
    const state = this.migrationState.status;

    return colorForState(state).replace('text-', 'bg-');
  }

  get isPaused() {
    const conditions = this?.status?.conditions || [];
    const isPause = conditions.filter((cond) => cond.type === PAUSED).length > 0;

    return isPause ? {
      status:  PAUSED,
      message: PAUSED_VM_MODAL_MESSAGE
    } : null;
  }

  get isRunning() {
    if (this?.status?.phase === VMIPhase.Running) {
      return { status: VMIPhase.Running };
    }

    return null;
  }

  get isTerminated() {
    const conditions = this?.status?.conditions || [];

    return conditions.find((cond) => cond.type === 'Ready')?.status === 'False';
  }

  get getVMIApiPath() {
    const clusterId = this.$rootGetters['clusterId'];

    if (this.$rootGetters['isMultiCluster']) {
      const prefix = `/k8s/clusters/${ clusterId }`;

      return `${ prefix }/apis/subresources.kubevirt.io/v1/namespaces/${ this.metadata.namespace }/virtualmachineinstances/${ this.name }/vnc`;
    } else {
      return `/apis/subresources.kubevirt.io/v1/namespaces/${ this.metadata.namespace }/virtualmachineinstances/${ this.name }/vnc`;
    }
  }

  get realAttachNodeName() {
    const nodeName = this?.status?.nodeName;
    const node = this.$getters['byId'](NODE, nodeName);

    return node?.nameDisplay || '';
  }

  get getSerialConsolePath() {
    const clusterId = this.$rootGetters['clusterId'];

    if (this.$rootGetters['isMultiCluster']) {
      const prefix = `/k8s/clusters/${ clusterId }`;

      return `${ prefix }/apis/subresources.kubevirt.io/v1/namespaces/${ this.metadata.namespace }/virtualmachineinstances/${ this.name }/console`;
    } else {
      return `/apis/subresources.kubevirt.io/v1/namespaces/${ this.metadata.namespace }/virtualmachineinstances/${ this.name }/console`;
    }
  }
}
