//@ts-nocheck
import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import extensionRoutes from './routing/harvester-routing';
import harvesterCommonStore from './store/harvester-common';
import harvesterStore from './store/harvester-store';
import customValidators from './validators';
import { PRODUCT_NAME } from './config/harvester';
import { defineAsyncComponent } from 'vue';
import semver from 'semver';
import './styles/vue-flow.scss';

// Init the package
export default function(plugin: IPlugin) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isSingleVirtualCluster = process.env.rancherEnv === PRODUCT_NAME;

  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  const version = semver.parse(plugin.metadata.version);
  const isHarvesterPrime = (version?.patch ?? 0) > 0;
  const rancher = typeof plugin.metadata.rancher === 'object' ? plugin.metadata.rancher : {};

  plugin.metadata.description = isHarvesterPrime ? 'Rancher UI Extension for Harvester Prime' : 'Rancher UI Extension for Harvester';
  plugin.metadata.rancher = {
    ...rancher,
    annotations: {
      ...rancher?.annotations,
      'catalog.cattle.io/display-name': isHarvesterPrime ? 'SUSE Virtualization' : 'Harvester',
    },
  };
  plugin.metadata.icon = isHarvesterPrime ? require('./harvester-prime.svg') : require('./icon.svg');

  plugin.addProduct(require('./config/harvester-cluster'));

  plugin.addDashboardStore(harvesterCommonStore.config.namespace, harvesterCommonStore.specifics, harvesterCommonStore.config);
  plugin.addDashboardStore(harvesterStore.config.namespace, harvesterStore.specifics, harvesterStore.config, harvesterStore.init);
  plugin.validators = customValidators;

  plugin.addRoutes(extensionRoutes);

  plugin.register('component', 'NavHeaderRight', defineAsyncComponent(() =>
    import('./components/HarvesterUpgradeHeader.vue')
  ));
}
