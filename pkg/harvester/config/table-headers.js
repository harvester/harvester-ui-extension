/**
 * Harvester
 */
import {
  DESCRIPTION, STATE, AGE, NAME, NAMESPACE
} from '@shell/config/table-headers';
import { HCI as HCI_ANNOTATIONS } from './labels-annotations';

// image
export const IMAGE_DOWNLOAD_SIZE = {
  name:     'downloadedBytes',
  labelKey: 'tableHeaders.size',
  value:    'downSize',
  sort:     'status.size',
};

export const IMAGE_VIRTUAL_SIZE = {
  name:     'virtualSize',
  labelKey: 'harvester.tableHeaders.virtualSize',
  value:    'virtualSize',
  sort:     'status.virtualSize',
};

export const IMAGE_PROGRESS = {
  name:      'Uploaded',
  labelKey:  'tableHeaders.progress',
  value:     'status.progress',
  sort:      'status.progress',
  formatter: 'ImagePercentageBar',
};

// SSH keys
export const FINGERPRINT = {
  name:     'Fingerprint',
  labelKey: 'tableHeaders.fingerprint',
  value:    'status.fingerPrint',
};

// The column of target volume on snapshot list page
export const SNAPSHOT_TARGET_VOLUME = {
  name:      'TargetVolume',
  labelKey:  'harvester.tableHeaders.snapshotTargetVolume',
  value:     'spec.source.persistentVolumeClaimName',
  sort:      'spec.source.persistentVolumeClaimName',
  formatter: 'SnapshotTargetVolume',
};

// The column of cron expression volume on VM schedules list page
export const VM_SCHEDULE_CRON = {
  name:      'CronExpression',
  labelKey:  'harvester.tableHeaders.cronExpression',
  value:     'spec.cron',
  align:     'center',
  sort:      'spec.cron',
  formatter: 'HarvesterCronExpression',
};

// The column of retain on VM schedules list page
export const VM_SCHEDULE_RETAIN = {
  name:     'Retain',
  labelKey: 'harvester.tableHeaders.retain',
  value:    'spec.retain',
  sort:     'spec.retain',
  align:    'center',
};

// The column of maxFailure on VM schedules list page
export const VM_SCHEDULE_MAX_FAILURE = {
  name:     'MaxFailure',
  labelKey: 'harvester.tableHeaders.maxFailure',
  value:    'spec.maxFailure',
  sort:     'spec.maxFailure',
  align:    'center',
};

// The column of type on VM schedules list page
export const VM_SCHEDULE_TYPE = {
  name:     'Type',
  labelKey: 'harvester.tableHeaders.scheduleType',
  value:    'spec.vmbackup.type',
  sort:     'spec.vmbackup.type',
  align:    'center',
};

// The MACHINE_POOLS column in Virtualization Management list page
export const MACHINE_POOLS = {
  name:     'summary',
  labelKey: 'tableHeaders.machines',
  sort:     false,
  search:   false,
  value:    'nodes.length',
  align:    'center',
  width:    100,
};

// The STORAGE_CLASS column in VM image list page
export const IMAGE_STORAGE_CLASS = {
  name:     'imageStorageClass',
  labelKey: 'harvester.tableHeaders.storageClass',
  sort:     'imageStorageClass',
  value:    'imageStorageClass',
  align:    'left',
  width:    150,
};

export const HARVESTER_DESCRIPTION = {
  ...DESCRIPTION,
  width: 150,
};

// The CIDR_BLOCK column in VPC list page
export const CIDR_BLOCK = {
  name:     'cidrBlock',
  labelKey: 'harvester.subnet.cidrBlock.label',
  sort:     'cidrBlock',
  value:    'spec.cidrBlock',
  align:    'left',
};

// The Protocol column in VPC list page
export const PROTOCOL = {
  name:     'protocol',
  labelKey: 'harvester.subnet.protocol.label',
  sort:     'protocol',
  value:    'spec.protocol',
  align:    'left',
};

// The Provider column in VPC list page
export const PROVIDER = {
  name:     'provider',
  labelKey: 'harvester.subnet.provider.label',
  sort:     'provider',
  value:    'spec.provider',
  align:    'left',
};

// Source VM column in migration.harvesterhci.io.virtualmachineimport list page
export const VM_IMPORT_SOURCE_VM = {
  name:     'sourceVm',
  labelKey: 'harvester.tableHeaders.vmImportSourceVm',
  value:    'spec.virtualMachineName',
  sort:     'spec.virtualMachineName',
  align:    'left',
};

// Source Cluster column in migration.harvesterhci.io.virtualmachineimport list page
export const VM_IMPORT_SOURCE_CLUSTER = {
  name:     'sourceCluster',
  labelKey: 'harvester.tableHeaders.vmImportSourceCluster',
  value:    'spec.sourceCluster.name',
  sort:     'spec.sourceCluster.name',
  align:    'left',
};

// Import Status column in migration.harvesterhci.io.virtualmachineimport list page
export const VM_IMPORT_STATUS = {
  name:     'importStatus',
  labelKey: 'harvester.tableHeaders.vmImportStatus',
  value:    'status.importStatus',
  sort:     'status.importStatus',
  align:    'left',
};

// Datacenter column in migration.harvesterhci.io.vmwaresource list page
export const VM_IMPORT_SOURCE_V_DC = {
  name:     'datacenter',
  labelKey: 'harvester.tableHeaders.vmImportSourceVDatacenter',
  value:    'spec.dc',
  sort:     'spec.dc',
  align:    'left',
};

// Endpoint column in migration.harvesterhci.io.vmwaresource list page
export const VM_IMPORT_SOURCE_V_ENDPOINT = {
  name:     'endpoint',
  labelKey: 'harvester.tableHeaders.vmImportSourceVEndpoint',
  value:    'spec.endpoint',
  sort:     'spec.endpoint',
  align:    'left',
};

// Cluster Status column in migration.harvesterhci.io.vmwaresource list page
export const VM_IMPORT_SOURCE_V_STATUS = {
  name:     'clusterStatus',
  labelKey: 'harvester.tableHeaders.vmImportSourceVClusterStatus',
  value:    'status.status',
  sort:     'status.status',
  align:    'left',
};

// Region column in migration.harvesterhci.io.openstacksource list page
export const VM_IMPORT_SOURCE_O_REGION = {
  name:     'region',
  labelKey: 'harvester.tableHeaders.vmImportSourceORegion',
  value:    'spec.region',
  sort:     'spec.region',
  align:    'left',
};

// Endpoint column in migration.harvesterhci.io.openstacksource list page
export const VM_IMPORT_SOURCE_O_ENDPOINT = {
  name:     'endpoint',
  labelKey: 'harvester.tableHeaders.vmImportSourceOEndpoint',
  value:    'spec.endpoint',
  sort:     'spec.endpoint',
  align:    'left',
};

// Cluster Status column in migration.harvesterhci.io.openstacksource list page
export const VM_IMPORT_SOURCE_O_STATUS = {
  name:     'clusterStatus',
  labelKey: 'harvester.tableHeaders.vmImportSourceOClusterStatus',
  value:    'status.status',
  sort:     'status.status',
  align:    'left',
};

// URL column in migration.harvesterhci.io.ovasource list page
export const VM_IMPORT_SOURCE_OVA_URL = {
  name:     'url',
  labelKey: 'harvester.tableHeaders.vmImportSourceOVAUrl',
  value:    'spec.url',
  sort:     'spec.url',
  align:    'left',
};

// Status column in migration.harvesterhci.io.ovasource list page
export const VM_IMPORT_SOURCE_OVA_STATUS = {
  name:     'status',
  labelKey: 'harvester.tableHeaders.vmImportSourceOVAStatus',
  value:    'status.status',
  sort:     'status.status',
  align:    'left',
};

// ========================================
// Forklift table headers
// ========================================

// Provider type column in forklift.konveyor.io.provider list page
export const FORKLIFT_PROVIDER_TYPE = {
  name:     'providerType',
  labelKey: 'harvester.tableHeaders.vmMigrationProviderType',
  value:    'spec.type',
  sort:     'spec.type',
  align:    'left',
};

// Provider URL column in forklift.konveyor.io.provider list page
export const FORKLIFT_PROVIDER_URL = {
  name:     'providerUrl',
  labelKey: 'harvester.tableHeaders.vmMigrationProviderUrl',
  value:    'spec.url',
  sort:     'spec.url',
  align:    'left',
};

// Source provider column in forklift network/storage map list page
export const FORKLIFT_MAP_SOURCE_PROVIDER = {
  name:     'sourceProvider',
  labelKey: 'harvester.tableHeaders.vmMigrationMapSourceProvider',
  value:    'spec.provider.source.name',
  sort:     'spec.provider.source.name',
  align:    'left',
};

// Destination provider column in forklift network/storage map list page
export const FORKLIFT_MAP_DEST_PROVIDER = {
  name:     'destProvider',
  labelKey: 'harvester.tableHeaders.vmMigrationMapDestProvider',
  value:    'spec.provider.destination.name',
  sort:     'spec.provider.destination.name',
  align:    'left',
};

// Target namespace column in forklift.konveyor.io.plan list page
export const FORKLIFT_PLAN_TARGET_NS = {
  name:     'targetNamespace',
  labelKey: 'harvester.tableHeaders.vmMigrationPlanTargetNs',
  value:    'spec.targetNamespace',
  sort:     'spec.targetNamespace',
  align:    'left',
};

// VM count column in forklift.konveyor.io.plan list page
export const FORKLIFT_PLAN_VM_COUNT = {
  name:     'vmCount',
  labelKey: 'harvester.tableHeaders.vmMigrationPlanVmCount',
  value:    'spec.vms.length',
  sort:     'spec.vms.length',
  align:    'center',
};

// Plan reference column in forklift.konveyor.io.migration list page
export const FORKLIFT_MIGRATION_PLAN = {
  name:     'plan',
  labelKey: 'harvester.tableHeaders.vmMigrationMigrationPlan',
  value:    'spec.plan.name',
  sort:     'spec.plan.name',
  align:    'left',
};

// Virtual machine list
export const VM_HEADERS = [
  STATE,
  {
    ...NAME,
    width: 350,
    value: 'nameDisplay',
    sort:  ['nameDisplay'],
  },
  NAMESPACE,
  {
    name:        'CPU',
    label:       'CPU',
    sort:        ['displayCPU'],
    value:       'displayCPU',
    align:       'center',
    dashIfEmpty: true,
  },
  {
    name:          'Memory',
    value:         'displayMemory',
    sort:          ['memorySort'],
    align:         'center',
    labelKey:      'tableHeaders.memory',
    formatter:     'Si',
    formatterOpts: {
      opts: {
        increment: 1024, addSuffix: true, maxExponent: 3, minExponent: 3, suffix: 'i',
      },
      needParseSi: true
    },
  },
  {
    name:      'ip',
    label:     'IP Address',
    value:     'id',
    formatter: 'HarvesterIpAddress',
    labelKey:  'tableHeaders.ipAddress',
    sort:      ['id'],
  },
  // The VM list only shows it when the cluster's nodes can be seen
  {
    name:      'node',
    label:     'Node',
    value:     'nodeName',
    sort:      ['realAttachNodeName'],
    formatter: 'HarvesterHost',
    labelKey:  'harvester.tableHeaders.vm.node'
  },
  // The VM list only shows it while a backup is being restored
  {
    name:      'restoreProgress',
    labelKey:  'harvester.tableHeaders.restore',
    value:     'restoreProgress',
    align:     'left',
    formatter: 'HarvesterBackupProgressBar',
    width:     200,
  },
  {
    ...AGE,
    sort: 'metadata.creationTimestamp:desc',
  }
];

// With server-side pagination the API sorts and searches, so only the fields it indexes can be used. CPU, memory, IP,
// node and restore progress come from the VM model or other resources. The VM's printer columns are listed as Name, Age, Status, Ready, so its
// Status is `metadata.fields.2`
const VM_PAGINATION_FIELDS = {
  [STATE.name]: { sort: ['metadata.fields.2'], search: false },
  [NAME.name]:  {
    sort:   ['metadata.name'],
    search: ['metadata.name', `metadata.annotations[${ HCI_ANNOTATIONS.VM_DISPLAY_NAME }]`],
  },
  [NAMESPACE.name]: { sort: ['metadata.namespace'], search: 'metadata.namespace' },
  [AGE.name]:       { search: false },
};

export const VM_PAGINATION_HEADERS = VM_HEADERS.map((header) => ({
  ...header,
  ...(VM_PAGINATION_FIELDS[header.name] || { sort: false, search: false }),
}));
