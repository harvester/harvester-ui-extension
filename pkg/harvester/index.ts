//@ts-nocheck
import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import extensionRoutes from './routing/harvester-routing';
import harvesterCommonStore from './store/harvester-common';
import harvesterStore from './store/harvester-store';
import customValidators from './validators';
import { PRODUCT_NAME } from './config/harvester';
import {
  hostResolvesL10nGlobals, resolveL10nGlobals, standaloneProductName, PRODUCT_NAME_GLOBAL
} from './utils/l10n-globals';
import { defineAsyncComponent } from 'vue';
import './styles/vue-flow.scss';

// Init the package
export default function (plugin: IPlugin) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isSingleVirtualCluster = process.env.rancherEnv === PRODUCT_NAME;

  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  if (isSingleVirtualCluster) {
    // Standalone: the server-flavor setting picks the product name, see config/harvester-cluster
    plugin.register('l10n-global', PRODUCT_NAME_GLOBAL, standaloneProductName);
  } else if (!hostResolvesL10nGlobals(plugin.environment?.version)) {
    // Hosts older than Rancher 2.16 would show `[[Harvester]]` literally, so resolve the tokens here.
    // Mutating the module in place also updates the copy that importTypes registered.
    resolveL10nGlobals(require('./l10n/en-us.yaml'));
  }

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  // Built-in icon
  plugin.metadata.icon = require('./icon.svg');

  plugin.addProduct(require('./config/harvester-cluster'));

  plugin.addDashboardStore(harvesterCommonStore.config.namespace, harvesterCommonStore.specifics, harvesterCommonStore.config);
  plugin.addDashboardStore(harvesterStore.config.namespace, harvesterStore.specifics, harvesterStore.config, harvesterStore.init);
  plugin.validators = customValidators;

  plugin.addRoutes(extensionRoutes);

  plugin.register('component', 'NavHeaderRight', defineAsyncComponent(() =>
    import('./components/HarvesterNavHeaderRight.vue')
  ));
}
