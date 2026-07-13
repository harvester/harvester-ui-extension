// eslint-disable-next-line import/named
// import { RouteRecordRaw } from 'vue-router';
import { PRODUCT_NAME } from '../config/harvester';

import Root from '../pages/c/_cluster/index.vue';
import HarvesterSupport from '../pages/c/_cluster/support/index.vue';
import HarvesterConsoleSerial from '../pages/c/_cluster/console/_uid/serial.vue';
import HarvesterConsoleVnc from '../pages/c/_cluster/console/_uid/vnc.vue';
import ListHarvesterResource from '../pages/c/_cluster/_resource/index.vue';
import HarvesterBrand from '../pages/c/_cluster/brand/index.vue';
import CreateHarvesterResource from '../pages/c/_cluster/_resource/create.vue';
import ViewHarvesterResource from '../pages/c/_cluster/_resource/_id.vue';
import ViewHarvesterNsResource from '../pages/c/_cluster/_resource/_namespace/_id.vue';
import HarvesterAirgapUpdgrade from '../pages/c/_cluster/airgapupgrade/index.vue';
import HarvesterMembers from '../pages/c/_cluster/members/index.vue';
import ProjectNamespaces from '../pages/c/_cluster/projectsnamespaces.vue';
import HarvesterAlertmanagerReceiver from '../pages/c/_cluster/alertmanagerconfig/_alertmanagerconfigid/receiver.vue';
import HarvesterUnsupported from '../pages/c/_cluster/unsupported/index.vue';
import ForkliftDashboard from '../pages/c/_cluster/vm-migration/index.vue';
import ForkliftVmMigrationWizard from '../pages/c/_cluster/vm-migration/vm-migration-wizard.vue';
import ForkliftProviderWizard from '../pages/c/_cluster/vm-migration/provider-wizard.vue';

const routes = [
  {
    route: {
      name:      `${ PRODUCT_NAME }-c-cluster-unsupported-standalone`,
      path:      `/:product`,
      component: HarvesterUnsupported
    },
    parent: 'blank'
  },
  {
    route: {
      name:      `${ PRODUCT_NAME }-c-cluster-unsupported`,
      path:      `/:product`,
      component: HarvesterUnsupported
    },
    parent: 'plain'
  },
  {
    name:      `${ PRODUCT_NAME }-c-cluster-support`,
    path:      `/:product/c/:cluster/support`,
    component: HarvesterSupport,
  },
  {
    route: {
      name:      `${ PRODUCT_NAME }-c-cluster-console-uid-serial`,
      path:      `/:product/c/:cluster/console/:uid/serial`,
      component: HarvesterConsoleSerial,
    },
    parent: 'blank'
  },
  {
    route: {
      name:      `${ PRODUCT_NAME }-c-cluster-console-uid-vnc`,
      path:      `/:product/c/:cluster/console/:uid/vnc`,
      component: HarvesterConsoleVnc,
    },
    parent: 'blank'
  },
  {
    name:      `${ PRODUCT_NAME }-c-cluster-airgapupgrade`,
    path:      `/:product/c/:cluster/airgapupgrade`,
    component: HarvesterAirgapUpdgrade,
  },
  {
    name:      `${ PRODUCT_NAME }-c-cluster-brand`,
    path:      `/:product/c/:cluster/brand`,
    component: HarvesterBrand,
  },
  {
    name:      `${ PRODUCT_NAME }-c-cluster-alertmanagerconfig-alertmanagerconfigid-receiver`,
    path:      `/:product/c/:cluster/alertmanagerconfig/:alertmanagerconfigid/receiver`,
    component: HarvesterAlertmanagerReceiver,
  },
  {
    name:      `${ PRODUCT_NAME }-c-cluster-members`,
    path:      `/:product/c/:cluster/members`,
    component: HarvesterMembers,
  },
  {
    name:      `${ PRODUCT_NAME }-c-cluster`,
    path:      `/:product/c/:cluster`,
    component: Root,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-projectsnamespaces`,
    path:      `/:product/c/:cluster/projectsnamespaces`,
    component: ProjectNamespaces,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-vm-migration`,
    path:      `/:product/c/:cluster/vm-migration`,
    component: ForkliftDashboard,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-vm-migration-wizard`,
    path:      `/:product/c/:cluster/vm-migration/wizard`,
    component: ForkliftVmMigrationWizard,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-vm-migration-provider-wizard`,
    path:      `/:product/c/:cluster/vm-migration/provider-wizard`,
    component: ForkliftProviderWizard,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-resource`,
    path:      `/:product/c/:cluster/:resource`,
    component: ListHarvesterResource,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-resource-create`,
    path:      `/:product/c/:cluster/:resource/create`,
    component: CreateHarvesterResource,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-resource-id`,
    path:      `/:product/c/:cluster/:resource/:id`,
    component: ViewHarvesterResource,
  }, {
    name:      `${ PRODUCT_NAME }-c-cluster-resource-namespace-id`,
    path:      `/:product/c/:cluster/:resource/:namespace/:id`,
    component: ViewHarvesterNsResource,
  },

];

export default routes;
