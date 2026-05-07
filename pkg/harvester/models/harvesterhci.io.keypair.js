import { get } from '@shell/utils/object';
import { findBy } from '@shell/utils/array';
import HarvesterResource from './harvester';

export default class HciKeypair extends HarvesterResource {
  get _availableActions() {
    let out = super._availableActions;

    out = out.map((action) => {
      if (['download'].includes(action.action)) {
        return { ...action, enabled: !!this.linkFor('update') };
      }

      return action;
    });

    return out;
  }

  get stateDisplay() {
    const conditions = get(this, 'status.conditions');
    const status = (findBy(conditions, 'type', 'validated') || {}).status ;

    return status === 'True' ? 'Validated' : 'Not Validated';
  }
}
