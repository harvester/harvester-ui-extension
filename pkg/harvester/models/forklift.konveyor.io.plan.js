import HarvesterResource from './harvester';
import { HCI } from '../types';
import { PRODUCT_NAME } from '../config/harvester';
import { randomStr } from '@shell/utils/string';

export default class ForkliftPlan extends HarvesterResource {
  get listLocation() {
    return {
      name:   `${ PRODUCT_NAME }-c-cluster-vm-migration`,
      params: {
        product: this.$rootGetters['productId'],
        cluster: this.$rootGetters['clusterId'],
      },
    };
  }

  /**
   * The base HarvesterResource sets `doneOverride` to `listLocation`, which would
   * force every single-item delete to redirect to the VM Migration dashboard.
   * Return undefined so the delete flow stays on the current page (list/dashboard)
   * and only falls back to the shell's default navigation when a now-invalid
   * detail page is being viewed.
   */
  get doneOverride() {
    return undefined;
  }

  get planFailed() {
    const conditions = this.status?.conditions || [];

    return conditions.some((c) => c.type === 'Failed' && c.status === 'True');
  }

  get planCritical() {
    const conditions = this.status?.conditions || [];

    return conditions.some((c) => c.category === 'Critical' && c.status === 'True');
  }

  get criticalMessages() {
    const conditions = this.status?.conditions || [];

    return conditions
      .filter((c) => c.category === 'Critical' && c.status === 'True')
      .map((c) => c.message);
  }

  get stateDescription() {
    if (this.metadata?.deletionTimestamp) {
      return null;
    }

    const messages = [];
    const conditions = this.status?.conditions || [];

    if (this.planFailed) {
      const failedMsg = conditions.find((c) => c.type === 'Failed' && c.status === 'True')?.message;

      if (failedMsg) {
        messages.push(failedMsg);
      }
    }

    if (this.planCritical) {
      messages.push(...this.criticalMessages);
    }

    return messages.length > 0 ? messages.join(' ') : null;
  }

  get stateObj() {
    return {
      error:         this.planFailed || this.planCritical,
      transitioning: this.isMigrating || this.isPendingMigrationStart || !!this.metadata?.deletionTimestamp,
      message:       this.stateDescription,
    };
  }

  get isMigrating() {
    const migration = this.status?.migration;

    return !!migration?.started && !migration?.completed;
  }

  // Right after creating a plan, controller status can lag briefly.
  // Treat this window as in-progress so we don't flash a succeeded badge.
  get isPendingMigrationStart() {
    const vmCount = this.spec?.vms?.length || 0;

    return vmCount > 0 && !this.planFailed && !this.planCritical && !this.planCanceled && !this.planSucceeded && !this.isMigrating;
  }

  get planCanceled() {
    const history = this.status?.migration?.history || [];

    if (history.length === 0) {
      return false;
    }

    const latest = history[history.length - 1];
    const conditions = latest.conditions || [];

    return conditions.some((c) => c.type === 'Canceled' && c.status === 'True');
  }

  get planSucceeded() {
    const migration = this.status?.migration;

    return !!migration?.completed && !this.planFailed && !this.planCanceled;
  }

  get stateDisplay() {
    if (this.metadata?.deletionTimestamp) {
      return 'Terminating';
    }

    if (this.planFailed) {
      return this.t('harvester.addons.vmMigration.plan.states.error');
    }

    if (this.planCritical) {
      return this.t('harvester.addons.vmMigration.plan.states.error');
    }

    if (this.planCanceled) {
      return this.t('harvester.addons.vmMigration.plan.states.canceled');
    }

    if (this.isMigrating) {
      return this.t('harvester.addons.vmMigration.plan.states.inProgress');
    }

    if (this.isPendingMigrationStart) {
      return this.t('harvester.addons.vmMigration.plan.states.inProgress');
    }

    return this.t('harvester.addons.vmMigration.plan.states.active');
  }

  get stateBackground() {
    if (this.metadata?.deletionTimestamp) {
      return 'bg-info';
    }

    if (this.planFailed) {
      return 'bg-error';
    }

    if (this.planCritical) {
      return 'bg-error';
    }

    if (this.planCanceled) {
      return 'bg-warning';
    }

    if (this.isMigrating) {
      return 'bg-info';
    }

    if (this.isPendingMigrationStart) {
      return 'bg-info';
    }

    return 'bg-success';
  }

  get isForkliftDashboard() {
    const route = this.currentRouter()?.currentRoute?.value;

    return route?.name?.endsWith('-vm-migration');
  }

  get _availableActions() {
    const canStop = this.isMigrating && !this.planCanceled;
    const canStart = !this.planSucceeded && (!this.isMigrating || this.planFailed || this.planCanceled || this.planCritical);
    const out = [];

    if (canStart) {
      out.push({
        action:  'startMigration',
        enabled: true,
        icon:    'icon icon-play',
        label:   this.isForkliftDashboard ? this.t('harvester.addons.vmMigration.plan.actions.restart') : this.t('harvester.addons.vmMigration.plan.actions.start'),
      });
    }

    if (canStop) {
      out.push({
        action:  'stopMigration',
        enabled: true,
        icon:    'icon icon-pause',
        label:   this.t('harvester.addons.vmMigration.plan.actions.stop'),
      });
    }

    if (this.isForkliftDashboard) {
      out.push({
        action:     'promptRemove',
        altAction:  'remove',
        label:      this.t('action.remove'),
        icon:       'icon icon-trash',
        bulkable:   true,
        enabled:    this.canDelete,
        bulkAction: 'promptRemove',
        weight:     -10,
      });

      return out;
    } else {
      out.push(...super._availableActions);

      return out;
    }
  }

  async stopMigration() {
    const history = this.status?.migration?.history || [];

    if (history.length === 0) {
      return;
    }

    const latest = history[history.length - 1];
    const migrationName = latest.migration?.name;

    if (migrationName) {
      const selfUrl = this.linkFor('self');
      const url = selfUrl.replace('forklift.konveyor.io.plans', 'forklift.konveyor.io.migrations').replace(`/${ this.metadata.name }`, `/${ migrationName }`);

      await this.$dispatch('request', { url, method: 'DELETE' });
    }
  }

  async startMigration() {
    const namespace = this.metadata.namespace;
    const history = this.status?.migration?.history || [];

    // Delete previous migrations before starting a new one
    for (const entry of history) {
      const name = entry.migration?.name;

      if (name) {
        const selfUrl = this.linkFor('self');
        const url = selfUrl.replace('forklift.konveyor.io.plans', 'forklift.konveyor.io.migrations').replace(`/${ this.metadata.name }`, `/${ name }`);

        try {
          await this.$dispatch('request', { url, method: 'DELETE' });
        } catch (e) {
          // Migration may already be gone — ignore 404s
        }
      }
    }

    const migration = await this.$dispatch('create', {
      type:     HCI.FORKLIFT_MIGRATION,
      metadata: {
        name:            `${ this.metadata.name }-migration-${ randomStr(5).toLowerCase() }`,
        namespace,
        ownerReferences: [
          {
            apiVersion:         'forklift.konveyor.io/v1beta1',
            kind:               'Plan',
            name:               this.metadata.name,
            uid:                this.metadata.uid,
            blockOwnerDeletion: true,
          },
        ],
      },
      spec: {
        plan: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'Plan',
          name:       this.metadata.name,
          namespace,
        },
      },
    });

    await migration.save();
  }

  async deletePlan() {
    await this.remove();
  }
}
