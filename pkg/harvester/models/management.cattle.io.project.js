
import shellProject from '@shell/models/management.cattle.io.project';

// This model controls `Project / Namespace` page in rancher integration mode
// Extend management.cattle.io.project model from shell
export default class Project extends shellProject {
  get _availableActions() {
    const canUpdate = !!this.linkFor('update');

    // disable `Edit Config` action if user does not have update permission.
    return super._availableActions.map((action) => {
      if (action.action === 'goToEdit') {
        return { ...action, enabled: canUpdate };
      }

      return action;
    });
  }
}
