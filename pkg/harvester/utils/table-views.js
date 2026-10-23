import { MANAGEMENT } from '@shell/config/types';
import { CONFIGURABLE_TABLES } from '@shell/store/features';

/**
 * The shell's table views feature (@rancher/shell 3.0.14), disabled, for the management store. Standalone Harvester
 * has no such feature on the server, so the shell uses its default, on, and every list gets the table views, which
 * drop the filters the lists put in the table header. Only kept in the store, nothing is saved.
 */
export function tableViewsOffFeature() {
  return {
    id:       CONFIGURABLE_TABLES,
    type:     MANAGEMENT.FEATURE,
    metadata: { name: CONFIGURABLE_TABLES },
    spec:     { value: false },
    status:   {
      default: true, dynamic: true, lockedValue: null
    },
  };
}
