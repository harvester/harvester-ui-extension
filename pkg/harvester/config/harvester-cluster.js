import {
  NODE,
  CONFIG_MAP,
  NAMESPACE,
  VIRTUAL_TYPES,
  MANAGEMENT,
  PVC,
  NETWORK_ATTACHMENT,
  MONITORING,
  LOGGING,
  STORAGE_CLASS,
  SECRET,
  NETWORK_POLICY
} from '@shell/config/types';
import { HCI, VOLUME_SNAPSHOT } from '../types';
import {
  STATE,
  NAME_UNLINKED,
  NAME as NAME_COL,
  AGE,
  NAMESPACE as NAMESPACE_COL,
  LOGGING_OUTPUT_PROVIDERS,
  OUTPUT,
  CLUSTER_OUTPUT,
  CONFIGURED_PROVIDERS,
  SUB_TYPE,
  ADDRESS,
  DESCRIPTION,
} from '@shell/config/table-headers';
import { IF_HAVE } from '@shell/store/type-map';
import {
  IMAGE_DOWNLOAD_SIZE,
  FINGERPRINT,
  IMAGE_PROGRESS,
  SNAPSHOT_TARGET_VOLUME,
  IMAGE_VIRTUAL_SIZE,
  IMAGE_STORAGE_CLASS,
  HARVESTER_DESCRIPTION
} from './table-headers';

const TEMPLATE = HCI.VM_VERSION;
const MONITORING_GROUP = 'Monitoring & Logging::Monitoring';
const LOGGING_GROUP = 'Monitoring & Logging::Logging';

export const PRODUCT_NAME = 'harvester';

export const IP_POOL_HEADERS = [
  STATE,
  NAME_COL,
  {
    name:     'subnet',
    labelKey: 'harvester.ipPool.subnet.label',
    value:    'subnetDisplay',
  },
  {
    name:     'availableIP',
    labelKey: 'harvester.ipPool.availableIP.label',
    value:    'status.available',
  },
  AGE
];

export function init($plugin, store) {
  const {
    product,
    basicType,
    headers,
    configureType,
    virtualType,
    weightGroup,
    weightType,
  } = $plugin.DSL(store, PRODUCT_NAME);

  const isSingleVirtualCluster = process.env.rancherEnv === PRODUCT_NAME;

  if (isSingleVirtualCluster) {
    const home = {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: {
        product:  PRODUCT_NAME,
        resource: HCI.DASHBOARD
      }
    };

    store.dispatch('setIsSingleProduct', {
      productName:       PRODUCT_NAME,
      logo:              require(`@shell/assets/images/providers/harvester.svg`),
      productNameKey:    'harvester.productLabel',
      getVersionInfo:    (store) => store.getters[`${ PRODUCT_NAME }/byId`]?.(HCI.SETTING, 'server-version')?.value || 'unknown',
      afterLoginRoute:   home,
      logoRoute:         home,
      supportCustomLogo: true
    });
  }

  product({
    inStore:               'harvester',
    removable:             false,
    showNamespaceFilter:   true,
    hideKubeShell:         true,
    hideKubeConfig:        true,
    showClusterSwitcher:   true,
    hideCopyConfig:        true,
    hideSystemResources:   true,
    customNamespaceFilter: true,
    typeStoreMap:          {
      [MANAGEMENT.PROJECT]:                       'management',
      [MANAGEMENT.CLUSTER_ROLE_TEMPLATE_BINDING]: 'management',
      [MANAGEMENT.PROJECT_ROLE_TEMPLATE_BINDING]: 'management'
    },
    supportRoute: { name: `${ PRODUCT_NAME }-c-cluster-support` },
    to:           {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: {
        product:  PRODUCT_NAME,
        resource: HCI.DASHBOARD
      }
    },
    hideNamespaceLocation: true,
  });

  basicType([HCI.DASHBOARD]);
  virtualType({
    labelKey: 'harvester.dashboard.label',
    group:    'Root',
    name:     HCI.DASHBOARD,
    weight:   500,
    route:    {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: {
        product:  PRODUCT_NAME,
        resource: HCI.DASHBOARD
      }
    }
  });
  configureType(HCI.DASHBOARD, { showListMasthead: false });

  configureType(HCI.HOST, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.HOST }
    },
    resource:       NODE,
    resourceDetail: HCI.HOST,
    resourceEdit:   HCI.HOST,
    canYaml:        false,
  });

  configureType(HCI.HOST, { isCreatable: false, isEditable: true });
  basicType([HCI.HOST]);

  virtualType({
    ifHaveType: NODE,
    labelKey:   'harvester.host.label',
    group:      'Root',
    name:       HCI.HOST,
    namespaced: true,
    weight:     399,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.HOST }
    },
    exact: false
  });

  // multiVirtualCluster
  basicType(['cluster-members'], 'rbac');
  virtualType({
    ifHave:     IF_HAVE.MULTI_CLUSTER,
    labelKey:   'members.clusterMembers',
    group:      'root',
    namespaced: false,
    name:       VIRTUAL_TYPES.CLUSTER_MEMBERS,
    weight:     100,
    route:      { name: `${ PRODUCT_NAME }-c-cluster-members` },
    exact:      true,
    ifHaveType: {
      type:  MANAGEMENT.CLUSTER_ROLE_TEMPLATE_BINDING,
      store: 'management'
    }
  });

  basicType([HCI.VM]);
  configureType(HCI.VM, { canYaml: false });
  virtualType({
    labelKey:   'harvester.virtualMachine.label',
    group:      'root',
    name:       HCI.VM,
    namespaced: true,
    weight:     299,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VM }
    },
    exact: false
  });

  // 1. Define the Group
  // We set the 3rd argument to false so the group header is hidden by default
  weightGroup('vmimport', 0, false);

  // 2. Configure Types (Static Definition)
  // We define the behavior and labels immediately so they are ready when needed.
  // We do NOT add them to 'basicType' here, so they remain hidden by default.

  const commonConfig = {
    isCreatable:    true,
    isEditable:     true,
    isRemovable:    true,
    showAge:        true,
    showState:      true,
    canYaml:        true,
    namespaced:     true,
    group:          'vmimport',
  };

  [HCI.VMIMPORT, HCI.VMIMPORT_SOURCE_V, HCI.VMIMPORT_SOURCE_O].forEach((type) => {
    configureType([type], {
      ...commonConfig,
      location: { name: `${ PRODUCT_NAME }-c-cluster-resource`, params: { resource: type } },
      resource: type,
    });
  });

  // Apply specific labels
  configureType([HCI.VMIMPORT], { labelKey: 'harvester.addons.vmImport.labels.vmimport' });
  configureType([HCI.VMIMPORT_SOURCE_V], { labelKey: 'harvester.addons.vmImport.labels.vmimportSourceVMWare' });
  configureType([HCI.VMIMPORT_SOURCE_O], { labelKey: 'harvester.addons.vmImport.labels.vmimportSourceOpenStack' });

  // 3. REACTIVE VISIBILITY CONTROLLER
  // This watches the addon status and toggles the menu entries accordingly.
  if (typeof window !== 'undefined') {
    // Constants for the check
    const ADDON_TYPE = 'harvesterhci.io.addon';
    const ADDON_NAME = 'vm-import-controller';

    /**
     * Forces the Harvester SideNav to re-render.
     * The SideNav component watches the 'favoriteTypes' preference.
     * By toggling a dummy favorite, we force it to refresh the menu tree.
     */
    const kickSideNav = () => {
      const TRIGGER = 'ui.refresh.trigger';

      store.dispatch('type-map/addFavorite', TRIGGER);
      setTimeout(() => store.dispatch('type-map/removeFavorite', TRIGGER), 500);
    };

    /**
     * Adds or Removes the types from the 'basicType' whitelist.
     * In Harvester (Basic Mode), items only appear if they are in this list.
     */
    const setMenuVisibility = (visible) => {
      const types = [HCI.VMIMPORT_SOURCE_V, HCI.VMIMPORT_SOURCE_O, HCI.VMIMPORT];

      if (visible) {
        store.commit('type-map/basicType', {
          product: PRODUCT_NAME,
          group:   'vmimport',
          types
        });
      } else {
        // To hide, we must physically remove the keys from the store state
        const basicTypes = store.state['type-map'].basicTypes[PRODUCT_NAME];

        if (basicTypes) {
          types.forEach((t) => delete basicTypes[t]);
        }
      }
      kickSideNav();
    };

    // Delay initialization to ensure the Harvester store module is registered
    setTimeout(() => {
      const waitForStore = setInterval(() => {
        // Wait until the 'addon' schema is loaded into the store
        if (store.getters['harvester/schemaFor'](ADDON_TYPE)) {
          clearInterval(waitForStore);

          // Watch the specific Addon resource for changes
          store.watch(
            (state, getters) => {
              const addons = getters['harvester/all'](ADDON_TYPE);
              const addon = addons.find((a) => a.metadata.name === ADDON_NAME);

              return addon?.spec?.enabled === true;
            },
            (isEnabled) => {
              setMenuVisibility(isEnabled);
            },
            { immediate: true }
          );
        }
      }, 1000);
    }, 2000);
  }

  basicType([HCI.VOLUME]);
  configureType(HCI.VOLUME, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VOLUME }
    },
    resource:       PVC,
    resourceDetail: HCI.VOLUME,
    resourceEdit:   HCI.VOLUME,
    canYaml:        false,
  });
  virtualType({
    labelKey:   'harvester.volume.label',
    group:      'root',
    ifHaveType: PVC,
    name:       HCI.VOLUME,
    namespaced: true,
    weight:     199,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VOLUME }
    },
    exact: false
  });

  basicType([HCI.IMAGE]);
  headers(HCI.IMAGE, [
    STATE,
    NAME_COL,
    NAMESPACE_COL,
    HARVESTER_DESCRIPTION,
    IMAGE_STORAGE_CLASS,
    IMAGE_PROGRESS,
    IMAGE_DOWNLOAD_SIZE,
    IMAGE_VIRTUAL_SIZE,
    AGE
  ]);
  configureType(HCI.IMAGE, { canYaml: false });
  virtualType({
    labelKey:   'harvester.image.label',
    group:      'root',
    name:       HCI.IMAGE,
    namespaced: true,
    weight:     198,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.IMAGE }
    },
    exact: false
  });

  basicType(['projects-namespaces']);
  virtualType({
    ifHave:     IF_HAVE.MULTI_CLUSTER,
    labelKey:   'harvester.projectNamespace.label',
    group:      'root',
    namespaced: true,
    name:       'projects-namespaces',
    weight:     98,
    route:      { name: `${ PRODUCT_NAME }-c-cluster-projectsnamespaces` },
    exact:      true,
  });

  if (isSingleVirtualCluster) {
    headers(NAMESPACE, [STATE, NAME_UNLINKED, DESCRIPTION, AGE]);
    basicType([NAMESPACE]);
    virtualType({
      labelKey:   'harvester.namespace.label',
      name:       NAMESPACE,
      namespaced: true,
      weight:     89,
      route:      {
        name:   `${ PRODUCT_NAME }-c-cluster-resource`,
        params: { resource: NAMESPACE }
      },
      exact: false,
    });
  }

  basicType([
    HCI.ALERTMANAGERCONFIG
  ], MONITORING_GROUP);

  basicType([
    HCI.CLUSTER_FLOW,
    HCI.CLUSTER_OUTPUT,
    HCI.FLOW,
    HCI.OUTPUT,
  ], LOGGING_GROUP);

  weightGroup('Monitoring', 2, true);
  weightGroup('Logging', 1, true);

  headers(HCI.ALERTMANAGERCONFIG, [
    STATE,
    NAME_COL,
    NAMESPACE_COL,
    {
      name:      'receivers',
      labelKey:  'tableHeaders.receivers',
      formatter: 'ReceiverIcons',
      value:     'name'
    },
  ]);

  configureType(HCI.ALERTMANAGERCONFIG, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.ALERTMANAGERCONFIG },
    },
    resource:       MONITORING.ALERTMANAGERCONFIG,
    resourceDetail: HCI.ALERTMANAGERCONFIG,
    resourceEdit:   HCI.ALERTMANAGERCONFIG,
    canYaml:        false
  });

  virtualType({
    ifHaveType: MONITORING.ALERTMANAGERCONFIG,
    labelKey:   'harvester.monitoring.alertmanagerConfig.label',
    name:       HCI.ALERTMANAGERCONFIG,
    namespaced: true,
    weight:     87,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.ALERTMANAGERCONFIG }
    },
    exact: false,
  });

  configureType(HCI.CLUSTER_FLOW, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLUSTER_FLOW },
    },
    resource:       LOGGING.CLUSTER_FLOW,
    resourceDetail: HCI.CLUSTER_FLOW,
    resourceEdit:   HCI.CLUSTER_FLOW,
    canYaml:        false,
  });

  virtualType({
    labelKey:   'harvester.logging.clusterFlow.label',
    name:       HCI.CLUSTER_FLOW,
    namespaced: true,
    weight:     79,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLUSTER_FLOW }
    },
    exact: false,
  });

  configureType(HCI.CLUSTER_OUTPUT, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLUSTER_OUTPUT },
    },
    resource:       LOGGING.CLUSTER_OUTPUT,
    resourceDetail: HCI.CLUSTER_OUTPUT,
    resourceEdit:   HCI.CLUSTER_OUTPUT,
    canYaml:        false,
  });

  virtualType({
    labelKey:   'harvester.logging.clusterOutput.label',
    name:       HCI.CLUSTER_OUTPUT,
    namespaced: true,
    weight:     78,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLUSTER_OUTPUT }
    },
    exact: false,
  });

  configureType(HCI.FLOW, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.FLOW },
    },
    resource:       LOGGING.FLOW,
    resourceDetail: HCI.FLOW,
    resourceEdit:   HCI.FLOW,
    canYaml:        false,
  });

  virtualType({
    labelKey:   'harvester.logging.flow.label',
    name:       HCI.FLOW,
    namespaced: true,
    weight:     77,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.FLOW }
    },
    exact: false,
  });

  configureType(HCI.OUTPUT, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.OUTPUT },
    },
    resource:       LOGGING.OUTPUT,
    resourceDetail: HCI.OUTPUT,
    resourceEdit:   HCI.OUTPUT,
    canYaml:        false,
  });

  virtualType({
    labelKey:   'harvester.logging.output.label',
    name:       HCI.OUTPUT,
    namespaced: true,
    weight:     76,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.OUTPUT }
    },
    exact: false,
  });

  headers(HCI.FLOW, [STATE, NAME_COL, NAMESPACE_COL, OUTPUT, CLUSTER_OUTPUT, CONFIGURED_PROVIDERS, AGE]);
  headers(HCI.OUTPUT, [STATE, NAME_COL, NAMESPACE_COL, LOGGING_OUTPUT_PROVIDERS, AGE]);
  headers(HCI.CLUSTER_FLOW, [STATE, NAME_COL, NAMESPACE_COL, CLUSTER_OUTPUT, CONFIGURED_PROVIDERS, AGE]);
  headers(HCI.CLUSTER_OUTPUT, [STATE, NAME_COL, NAMESPACE_COL, LOGGING_OUTPUT_PROVIDERS, AGE]);

  basicType(
    [
      HCI.CLUSTER_NETWORK,
      HCI.NETWORK_ATTACHMENT,
      HCI.VPC,
      NETWORK_POLICY,
      HCI.LB,
      HCI.IP_POOL,
    ],
    'networks'
  );

  basicType(
    [
      HCI.SCHEDULE_VM_BACKUP,
      HCI.BACKUP,
      HCI.SNAPSHOT,
      HCI.VM_SNAPSHOT,
    ],
    'backupAndSnapshot'
  );

  weightGroup('networks', 300, true);
  weightType(NAMESPACE, 299, true);
  weightGroup('backupAndSnapshot', 289, true);

  basicType(
    [
      TEMPLATE,
      HCI.SSH,
      HCI.CLOUD_TEMPLATE,
      HCI.STORAGE,
      HCI.SR_IOV,
      HCI.PCI_DEVICE,
      HCI.SR_IOVGPU_DEVICE,
      HCI.VGPU_DEVICE,
      HCI.MIG_CONFIGURATION,
      HCI.USB_DEVICE,
      HCI.ADD_ONS,
      HCI.SECRET,
      HCI.SETTING
    ],
    'advanced'
  );

  configureType(HCI.CLUSTER_NETWORK, {
    realResource: HCI.SETTING,
    showState:    false,
  });

  virtualType({
    labelKey:   'harvester.vmTemplate.label',
    group:      'root',
    name:       TEMPLATE,
    namespaced: true,
    weight:     289,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: TEMPLATE }
    },
    exact: false
  });
  configureType(TEMPLATE, { canYaml: false });

  configureType(HCI.SCHEDULE_VM_BACKUP, {
    showListMasthead: false, showConfigView: false, canYaml: false
  });
  virtualType({
    labelKey:   'harvester.schedule.label',
    name:       HCI.SCHEDULE_VM_BACKUP,
    namespaced: true,
    weight:     201,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SCHEDULE_VM_BACKUP }
    },
    exact:      false,
    ifHaveType: HCI.SCHEDULE_VM_BACKUP,
  });

  configureType(HCI.BACKUP, {
    showListMasthead: false, showConfigView: false, canYaml: false
  });
  virtualType({
    labelKey:   'harvester.backup.label',
    name:       HCI.BACKUP,
    namespaced: true,
    weight:     200,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.BACKUP }
    },
    exact: false
  });

  configureType(HCI.VLAN_CONFIG, { hiddenNamespaceGroupButton: true, canYaml: false });

  configureType(HCI.CLUSTER_NETWORK, { showListMasthead: false, canYaml: false });
  virtualType({
    labelKey:   'harvester.clusterNetwork.title',
    name:       HCI.CLUSTER_NETWORK,
    ifHaveType: HCI.CLUSTER_NETWORK,
    namespaced: false,
    weight:     189,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLUSTER_NETWORK }
    },
    exact: false,
  });

  configureType(HCI.NETWORK_ATTACHMENT, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.NETWORK_ATTACHMENT }
    },
    resource:       NETWORK_ATTACHMENT,
    resourceDetail: HCI.NETWORK_ATTACHMENT,
    resourceEdit:   HCI.NETWORK_ATTACHMENT
  });

  virtualType({
    labelKey:   'harvester.network.label',
    name:       HCI.NETWORK_ATTACHMENT,
    namespaced: true,
    weight:     188,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.NETWORK_ATTACHMENT }
    },
    exact: false
  });

  configureType(HCI.VPC, { hiddenNamespaceGroupButton: true, canYaml: false });

  virtualType({
    labelKey:   'harvester.vpc.label',
    name:       HCI.VPC,
    namespaced: true,
    weight:     187,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VPC }
    },
    exact:      false,
    ifHaveType: HCI.VPC,
  });

  configureType(NETWORK_POLICY, { hiddenNamespaceGroupButton: true, canYaml: false });

  virtualType({
    labelKey:   'harvester.networkPolicy.label',
    name:       NETWORK_POLICY,
    namespaced: true,
    weight:     186,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: NETWORK_POLICY }
    },
    exact:      false,
    ifHaveType: NETWORK_POLICY,
  });

  configureType(HCI.SNAPSHOT, {
    isCreatable: false,
    location:    {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SNAPSHOT },
    },
    resource:       VOLUME_SNAPSHOT,
    resourceDetail: HCI.SNAPSHOT,
    resourceEdit:   HCI.SNAPSHOT,
    canYaml:        false
  });
  headers(HCI.SNAPSHOT, [STATE, NAME_COL, NAMESPACE_COL, SNAPSHOT_TARGET_VOLUME, AGE]);
  virtualType({
    labelKey:   'harvester.snapshot.label',
    name:       HCI.SNAPSHOT,
    namespaced: true,
    weight:     190,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SNAPSHOT }
    },
    exact: false,
  });

  configureType(HCI.VM_SNAPSHOT, {
    showListMasthead: false,
    location:         {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VM_SNAPSHOT }
    },
    resource:       HCI.BACKUP,
    resourceDetail: HCI.VM_SNAPSHOT,
    resourceEdit:   HCI.VM_SNAPSHOT,
    canYaml:        false
  });

  virtualType({
    labelKey:   'harvester.vmSnapshot.label',
    name:       HCI.VM_SNAPSHOT,
    namespaced: true,
    weight:     191,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VM_SNAPSHOT }
    },
    exact: false
  });

  headers(HCI.SSH, [STATE, NAME_COL, NAMESPACE_COL, FINGERPRINT, AGE]);
  virtualType({
    labelKey:   'harvester.sshKey.label',
    name:       HCI.SSH,
    namespaced: true,
    weight:     170,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SSH }
    },
    exact: false
  });

  configureType(HCI.CLOUD_TEMPLATE, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLOUD_TEMPLATE }
    },
    resource:       CONFIG_MAP,
    resourceDetail: HCI.CLOUD_TEMPLATE,
    resourceEdit:   HCI.CLOUD_TEMPLATE,
    canYaml:        false
  });

  virtualType({
    labelKey:   'harvester.cloudTemplate.label',
    name:       HCI.CLOUD_TEMPLATE,
    namespaced: true,
    weight:     87,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.CLOUD_TEMPLATE }
    },
    exact: false
  });

  headers(HCI.SECRET, [
    STATE,
    NAME_COL,
    NAMESPACE_COL,
    SUB_TYPE,
    {
      name:      'data',
      labelKey:  'tableHeaders.data',
      value:     'dataPreview',
      formatter: 'SecretData'
    },
    AGE
  ]);

  configureType(HCI.SECRET, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SECRET }
    },
    resource:           SECRET,
    resourceDetail:     HCI.SECRET,
    resourceEdit:       HCI.SECRET,
    canYaml:            false,
    notFilterNamespace: ['cattle-monitoring-system', 'cattle-logging-system']
  });

  virtualType({
    labelKey:   'harvester.secret.label',
    name:       HCI.SECRET,
    namespaced: true,
    weight:     -999,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SECRET }
    },
    exact: false
  });

  // settings
  configureType(HCI.SETTING, { isCreatable: false });
  virtualType({
    ifHaveType: HCI.SETTING,
    ifHaveVerb: 'POST',
    labelKey:   'harvester.setting.label',
    name:       HCI.SETTING,
    namespaced: true,
    weight:     -1000,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SETTING }
    },
    exact: false
  });

  configureType(HCI.STORAGE, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.STORAGE }
    },
    resource:       STORAGE_CLASS,
    resourceDetail: HCI.STORAGE,
    resourceEdit:   HCI.STORAGE,
    isCreatable:    true,
    canYaml:        false,
  });
  virtualType({
    labelKey:   'harvester.storage.title',
    group:      'root',
    ifHaveType: STORAGE_CLASS,
    name:       HCI.STORAGE,
    namespaced: false,
    weight:     79,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.STORAGE }
    },
    exact: false,
  });

  virtualType({
    label:      'PCI Devices',
    group:      'advanced',
    weight:     14,
    name:       HCI.PCI_DEVICE,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.PCI_DEVICE }
    },
    exact: false,
  });

  configureType(HCI.PCI_DEVICE, {
    isCreatable:                false,
    hiddenNamespaceGroupButton: true,
    canYaml:                    true,
    listGroups:                 [
      {
        icon:       'icon-list-grouped',
        value:      'description',
        field:      'groupByDevice',
        hideColumn: 'description',
        tooltipKey: 'resourceTable.groupBy.device'
      },
      {
        icon:       'icon-cluster',
        value:      'node',
        field:      'groupByNode',
        hideColumn: 'node',
        tooltipKey: 'resourceTable.groupBy.node'
      }
    ]
  });

  virtualType({
    ifHaveType: HCI.SR_IOV,
    labelKey:   'harvester.sriov.label',
    group:      'advanced',
    weight:     15,
    name:       HCI.SR_IOV,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SR_IOV }
    },
    exact: false
  });

  configureType(HCI.SR_IOV, {
    isCreatable:                false,
    hiddenNamespaceGroupButton: true,
    canYaml:                    false,
  });

  virtualType({
    ifHaveType: HCI.SR_IOVGPU_DEVICE,
    labelKey:   'harvester.sriovgpu.label',
    group:      'advanced',
    weight:     13,
    name:       HCI.SR_IOVGPU_DEVICE,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.SR_IOVGPU_DEVICE }
    },
    exact: false,
  });

  configureType(HCI.SR_IOVGPU_DEVICE, {
    isCreatable:                false,
    hiddenNamespaceGroupButton: true,
    canYaml:                    false,
  });

  virtualType({
    labelKey:   'harvester.vgpu.label',
    group:      'advanced',
    weight:     12,
    name:       HCI.VGPU_DEVICE,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.VGPU_DEVICE }
    },
    exact: false,
  });

  configureType(HCI.VGPU_DEVICE, {
    isCreatable:                false,
    hiddenNamespaceGroupButton: true,
    canYaml:                    false,
    listGroups:                 [
      {
        icon:       'icon-cluster',
        value:      'node',
        field:      'groupByNode',
        hideColumn: 'node',
        tooltipKey: 'resourceTable.groupBy.node'
      }
    ]
  });

  virtualType({
    labelKey:   'harvester.migconfiguration.label',
    group:      'advanced',
    weight:     12,
    name:       HCI.MIG_CONFIGURATION,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.MIG_CONFIGURATION }
    },
    exact:      false,
    ifHaveType: HCI.MIG_CONFIGURATION,
  });

  configureType(HCI.MIG_CONFIGURATION, {
    isCreatable:                false,
    hiddenNamespaceGroupButton: true,
    canYaml:                    false,
  });

  virtualType({
    labelKey:   'harvester.usb.label',
    group:      'advanced',
    weight:     11,
    name:       HCI.USB_DEVICE,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.USB_DEVICE }
    },
    exact:      false,
    ifHaveType: HCI.USB_DEVICE,
  });

  configureType(HCI.USB_DEVICE, {
    isCreatable:                false,
    hiddenNamespaceGroupButton: true,
    canYaml:                    false,
    listGroups:                 [
      {
        icon:       'icon-list-grouped',
        value:      'description',
        field:      'groupByDevice',
        hideColumn: 'description',
        tooltipKey: 'resourceTable.groupBy.device'
      },
      {
        icon:       'icon-cluster',
        value:      'node',
        field:      'groupByNode',
        hideColumn: 'node',
        tooltipKey: 'resourceTable.groupBy.node'
      }
    ]
  });

  configureType(HCI.ADD_ONS, {
    isCreatable: false,
    isRemovable: false,
    showState:   false,
    canYaml:     false,
  });

  virtualType({
    label:      'Add-ons',
    group:      'advanced',
    name:       HCI.ADD_ONS,
    ifHaveType: HCI.ADD_ONS,
    weight:     -900,
    namespaced: false,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.ADD_ONS }
    },
    exact: false,
  });

  configureType(HCI.LB, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.LB }
    },
    canYaml: false,
  });
  virtualType({
    labelKey:   'harvester.loadBalancer.label',
    name:       HCI.LB,
    namespaced: true,
    weight:     185,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.LB }
    },
    exact:      false,
    ifHaveType: HCI.LB,
  });
  headers(HCI.LB, [
    STATE,
    NAME_COL,
    {
      ...ADDRESS,
      formatter: 'HarvesterListener',
    },
    {
      name:     'workloadType',
      labelKey: 'harvester.loadBalancer.workloadType.label',
      value:    'workloadTypeDisplay',
    },
    {
      name:     'ipam',
      labelKey: 'harvester.loadBalancer.ipam.label',
      value:    'ipamDisplay',
    },
    AGE
  ]);

  configureType(HCI.IP_POOL, {
    location: {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.IP_POOL }
    },
    canYaml: false,
  });
  virtualType({
    labelKey:   'harvester.ipPool.label',
    name:       HCI.IP_POOL,
    namespaced: false,
    weight:     184,
    route:      {
      name:   `${ PRODUCT_NAME }-c-cluster-resource`,
      params: { resource: HCI.IP_POOL }
    },
    exact:      false,
    ifHaveType: HCI.IP_POOL,
  });
  headers(HCI.IP_POOL, IP_POOL_HEADERS);
}
