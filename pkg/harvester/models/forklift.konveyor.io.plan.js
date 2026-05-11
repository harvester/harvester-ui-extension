import HarvesterResource from './harvester';
import { HCI } from '../types';
import { PRODUCT_NAME } from '../config/harvester';

export default class ForkliftPlan extends HarvesterResource {
  get listLocation() {
    return {
      name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
      params: {
        product: this.$rootGetters['productId'],
        cluster: this.$rootGetters['clusterId'],
      },
    };
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
      transitioning: this.isMigrating,
      message:       this.stateDescription,
    };
  }

  get isMigrating() {
    const migration = this.status?.migration;

    return !!migration?.started && !migration?.completed;
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
    if (this.planFailed) {
      return 'Error';
    }

    if (this.planCritical) {
      return 'Error';
    }

    if (this.planCanceled) {
      return 'Canceled';
    }

    if (this.isMigrating) {
      return 'In Progress';
    }

    return 'Active';
  }

  get stateBackground() {
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

    return 'bg-success';
  }

  get isForkliftDashboard() {
    const route = this.currentRouter()?.currentRoute?.value;

    return route?.name?.endsWith('-forklift');
  }

  get _availableActions() {
    if (this.isForkliftDashboard) {
      const canStop = this.isMigrating && !this.planCanceled;
      const canStart = !this.planSucceeded && (!this.isMigrating || this.planFailed || this.planCanceled || this.planCritical);
      const out = [];

      if (canStart) {
        out.push({
          action:  'startMigration',
          enabled: true,
          icon:    'icon icon-play',
          label:   'Start',
        });
      }

      if (canStop) {
        out.push({
          action:  'stopMigration',
          enabled: true,
          icon:    'icon icon-pause',
          label:   'Stop',
        });
      }

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
    }

    return super._availableActions;
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
        name:            `${ this.metadata.name }-migration-${ Math.random().toString(36).substring(2, 7) }`,
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

  /**
   * Deleting a Plan cascades via ownerReferences set at creation time.
   * Kubernetes GC will automatically delete: Migration, NetworkMap, StorageMap, Provider (→ Secret).
   * Use foreground propagation to ensure children are deleted before the parent.
   */
  remove() {
    const opt = { ...arguments };

    opt.params = { propagationPolicy: 'Background' };

    return this._remove(opt);
  }
}
