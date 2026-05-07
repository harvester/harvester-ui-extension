import HarvesterResource from './harvester';
import { HCI } from '../types';

export default class ForkliftPlan extends HarvesterResource {
  get planFailed() {
    const conditions = this.status?.conditions || [];

    return conditions.some((c) => c.type === 'Failed' && c.status === 'True');
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

  get stateDisplay() {
    if (this.planFailed) {
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

    if (this.planCanceled) {
      return 'bg-warning';
    }

    if (this.isMigrating) {
      return 'bg-info';
    }

    return 'bg-success';
  }

  get _availableActions() {
    const canStop = this.isMigrating && !this.planCanceled;
    const canStart = !this.isMigrating || this.planFailed || this.planCanceled;

    const out = super._availableActions;

    if (canStop) {
      out.unshift({
        action:  'stopMigration',
        enabled: true,
        icon:    'icon icon-pause',
        label:   'Stop',
      });
    }

    if (canStart) {
      out.unshift({
        action:  'startMigration',
        enabled: true,
        icon:    'icon icon-play',
        label:   'Start',
      });
    }

    return out;
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
