import HarvesterResource from './harvester';
import { colorForState, stateDisplay, STATES } from '@shell/plugins/dashboard-store/resource-class';
import { _CREATE } from '@shell/config/query-params';
import { ucFirst, escapeHtml } from '@shell/utils/string';

export default class ScheduleVmBackup extends HarvesterResource {
  detailPageHeaderActionOverride(realMode) {
    if (realMode === _CREATE) {
      return this.t('harvester.schedule.createTitle');
    }
  }

  get _availableActions() {
    const toFilter = ['goToClone'];

    const out = super._availableActions.filter((action) => {
      if (!toFilter.includes(action.action)) {
        return action;
      }
    });

    const canUpdate = !!this.linkFor('update');

    return [
      {
        action:  'resumeSchedule',
        enabled: canUpdate && ucFirst(this.state) === STATES.suspended.label,
        icon:    'icons icon-play',
        label:   this.t('harvester.action.resumeSchedule'),
      },
      {
        action:  'suspendSchedule',
        enabled: canUpdate && ucFirst(this.state) === STATES.active.label,
        icon:    'icons icon-pause',
        label:   this.t('harvester.action.suspendSchedule'),
      },
      ...out
    ];
  }

  async suspendSchedule() {
    try {
      this.spec.suspend = true; // suspend schedule
      await this.save();
    } catch (err) {
      this.spec.suspend = false;

      this.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error', { name: escapeHtml(this.metadata.name) }),
        err,
      }, { root: true });
    }
  }

  async resumeSchedule() {
    try {
      this.spec.suspend = false; // resume schedule
      await this.save();
    } catch (err) {
      this.spec.suspend = true;

      this.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error', { name: escapeHtml(this.metadata.name) }),
        err,
      }, { root: true });
    }
  }

  get stateObj() {
    return this?.metadata?.state || {};
  }

  get state() {
    return this.status?.suspended === true ? STATES.suspended.label : STATES.active.label;
  }

  get stateDescription() {
    const suspendedCondition = (this.status?.conditions || []).find((c) => c.type === 'BackupSuspend');

    return ucFirst(suspendedCondition?.message) || super.stateDescription;
  }

  get stateBackground() {
    return colorForState(this.stateDisplay).replace('text-', 'bg-');
  }

  get stateColor() {
    return colorForState(this.state);
  }

  get stateDisplay() {
    return stateDisplay(this.state);
  }
}
