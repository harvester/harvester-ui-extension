<script>
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax';
import utc from 'dayjs/plugin/utc';
import { mapGetters } from 'vuex';
import Loading from '@shell/components/Loading';
import Banner from '@components/Banner/Banner.vue';
import MessageLink from '@shell/components/MessageLink';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { Checkbox } from '@components/Form/Checkbox';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import AsyncButton from '@shell/components/AsyncButton';
import { allHash, setPromiseResult } from '@shell/utils/promise';
import { parseSi, formatSi, exponentNeeded, UNITS } from '@shell/utils/units';
import { REASON } from '@shell/config/table-headers';
import {
  EVENT, METRIC, NODE, SERVICE, PVC, LONGHORN, POD, COUNT, NETWORK_ATTACHMENT
} from '@shell/config/types';
import ResourceSummary, { resourceCounts, colorToCountName } from '@shell/components/ResourceSummary';
import { colorForState } from '@shell/plugins/dashboard-store/resource-class';
import HardwareResourceGauge from '@shell/components/HardwareResourceGauge';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import DashboardMetrics from '@shell/components/DashboardMetrics';
import metricPoller from '@shell/mixins/metric-poller';
import { allDashboardsExist } from '@shell/utils/grafana';
import { isEmpty } from '@shell/utils/object';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../types';
import HarvesterUpgrade from '../components/HarvesterUpgrade';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import { UNIT_SUFFIX } from '../utils/unit';

dayjs.extend(utc);
dayjs.extend(minMax);

const PARSE_RULES = {
  format: {
    addSuffix:        true,
    firstSuffix:      UNIT_SUFFIX,
    increment:        1024,
    maxExponent:      99,
    maxPrecision:     2,
    minExponent:      0,
    startingExponent: 0,
    suffix:           UNIT_SUFFIX,
  }
};

const RESOURCES = [{
  type:    NODE,
  spoofed: {
    location: {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
      params: { resource: HCI.HOST }
    },
    name: HCI.HOST,
  }
},
{
  type:    HCI.VM,
  spoofed: {
    location: {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
      params: { resource: HCI.VM }
    },
    name: HCI.VM,
  }
},
{
  type:    NETWORK_ATTACHMENT,
  spoofed: {
    location: {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
      params: { resource: HCI.NETWORK_ATTACHMENT }
    },
    name:            HCI.NETWORK_ATTACHMENT,
    filterNamespace: ['harvester-system']
  }
},
{
  type:    HCI.IMAGE,
  spoofed: {
    location: {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
      params: { resource: HCI.IMAGE }
    },
    name: HCI.IMAGE,
  }
},
{
  type:    PVC,
  spoofed: {
    location: {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
      params: { resource: HCI.VOLUME }
    },
    name:            HCI.VOLUME,
    filterNamespace: ['cattle-monitoring-system']
  }
},
{
  type:    HCI.BLOCK_DEVICE,
  spoofed: {
    location: {
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
      params: { resource: HCI.HOST }
    },
    name: HCI.BLOCK_DEVICE,
  },
}];

const CLUSTER_METRICS_DETAIL_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/rancher-cluster-nodes-1/rancher-cluster-nodes?orgId=1';
const CLUSTER_METRICS_SUMMARY_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/rancher-cluster-1/rancher-cluster?orgId=1';
const VM_DASHBOARD_METRICS_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/harvester-vm-dashboard-1/vm-dashboard?orgId=1';

const MONITORING_ID = 'cattle-monitoring-system/rancher-monitoring';

const COMPONENT_LABEL = 'health.harvesterhci.io/component';
const NODE_LABEL = 'health.harvesterhci.io/node';
const IGNORE_RULE_SOURCE_LABEL = 'health.harvesterhci.io/source';
const IGNORED_BY_MIN_SEVERITY = 'min-severity';
const IGNORE_DURATION_DAYS = {
  days7:   7,
  days30:  30,
  forever: 0,
};
const AFFECTED_RESOURCES_TRUNCATE_COUNT = 5;
const MESSAGE_TRUNCATE_LENGTH = 100;

const SEVERITY_COLORS = {
  Critical: 'bg-error',
  Error:    'bg-error',
  Warning:  'bg-warning',
  Info:     'bg-info',
  Healthy:  'bg-success',
};

const COMPONENT_HEALTH_SEVERITIES = ['Error', 'Warning', 'Info'];

export default {
  mixins:     [metricPoller],
  components: {
    Loading,
    HardwareResourceGauge,
    SortableTable,
    HarvesterUpgrade,
    ResourceSummary,
    Tabbed,
    Tab,
    DashboardMetrics,
    Banner,
    MessageLink,
    BadgeState,
    Checkbox,
    LabeledInput,
    RadioGroup,
    LabeledSelect,
    AsyncButton,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = {
      vms:              this.fetchClusterResources(HCI.VM),
      pvcs:             this.fetchClusterResources(PVC),
      nodes:            this.fetchClusterResources(NODE),
      events:           this.fetchClusterResources(EVENT),
      metricNodes:      this.fetchClusterResources(METRIC.NODE),
      settings:         this.fetchClusterResources(HCI.SETTING),
      services:         this.fetchClusterResources(SERVICE),
      metric:           this.fetchClusterResources(METRIC.NODE),
      longhornNodes:    this.fetchClusterResources(LONGHORN.NODES),
      longhornSettings: this.fetchClusterResources(LONGHORN.SETTINGS),
      componentHealths: this.fetchClusterResources(HCI.COMPONENT_HEALTH),
      healthSummaries:  this.fetchClusterResources(HCI.HEALTH_SUMMARY),
      ignoreRules:      this.fetchClusterResources(HCI.HEALTH_IGNORE_RULE),
      _pods:            this.$store.dispatch('harvester/findAll', { type: POD }),
    };

    (this.accessibleResources || []).map((a) => {
      hash[a.type] = this.$store.dispatch(`${ inStore }/findAll`, { type: a.type });

      return null;
    });

    if (this.$store.getters[`${ inStore }/schemaFor`](HCI.ADD_ONS)) {
      hash.addons = this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.ADD_ONS });
    }

    if (this.$store.getters[`${ inStore }/schemaFor`](LONGHORN.NODES)) {
      this.hasLonghornSchema = true;
    }

    const res = await allHash(hash);

    for ( const k in res ) {
      this[k] = res[k];
    }

    setPromiseResult(
      allDashboardsExist(this.$store, this.currentCluster.id, [CLUSTER_METRICS_DETAIL_URL, CLUSTER_METRICS_SUMMARY_URL], 'harvester'),
      this,
      'showClusterMetrics',
      'Determine cluster metrics'
    );
    setPromiseResult(
      allDashboardsExist(this.$store, this.currentCluster.id, [VM_DASHBOARD_METRICS_URL], 'harvester'),
      this,
      'showVmMetrics',
      'Determine vm metrics'
    );

    const addons = this.$store.getters[`${ inStore }/all`](HCI.ADD_ONS);

    this.monitoring = addons.find((addon) => addon.id === MONITORING_ID);
    this.enabledMonitoringAddon = this.monitoring?.spec?.enabled;
  },

  data() {
    const reason = {
      ...REASON,
      ...{ canBeVariable: true },
      width: 130
    };

    const eventHeaders = [
      reason,
      {
        name:          'resource',
        label:         'Resource',
        labelKey:      'clusterIndexPage.sections.events.resource.label',
        value:         'displayInvolvedObject',
        sort:          ['involvedObject.kind', 'involvedObject.name'],
        canBeVariable: true,
      },
      {
        align:         'right',
        name:          'date',
        label:         'Date',
        labelKey:      'clusterIndexPage.sections.events.date.label',
        value:         'lastTimestamp',
        sort:          'lastTimestamp:desc',
        formatter:     'LiveDate',
        formatterOpts: { addSuffix: true },
        width:         125,
        defaultSort:   true,
      },
    ];

    const healthSummaryHeaders = [
      {
        name:     'severity',
        labelKey: 'harvester.dashboard.sections.healthSummary.severity',
        value:    'severity',
        sort:     'severity',
        width:    110,
      },
      {
        name:     'component',
        labelKey: 'harvester.dashboard.sections.healthSummary.component',
        value:    'component',
        sort:     'component',
      },
      {
        align:    'right',
        name:     'errorCount',
        labelKey: 'harvester.dashboard.sections.healthSummary.errorCount',
        value:    'errorCount',
        sort:     'errorCount',
        width:    120,
      },
      {
        align:    'right',
        name:     'warningCount',
        labelKey: 'harvester.dashboard.sections.healthSummary.warningCount',
        value:    'warningCount',
        sort:     'warningCount',
        width:    120,
      },
      {
        align:         'right',
        name:          'lastUpdatedAt',
        labelKey:      'harvester.dashboard.sections.healthSummary.lastUpdatedAt',
        value:         'lastUpdatedAt',
        sort:          'lastUpdatedAt:desc',
        formatter:     'LiveDate',
        formatterOpts: { addSuffix: true },
        width:         140,
      },
    ];

    const componentHealthHeaders = [
      {
        name:     'severity',
        labelKey: 'harvester.dashboard.sections.componentHealth.severity',
        value:    'severity',
        sort:     'severity',
        width:    110,
      },
      {
        name:     'node',
        labelKey: 'harvester.dashboard.sections.componentHealth.node',
        value:    'node',
        sort:     'node',
      },
      {
        name:     'checkName',
        labelKey: 'harvester.dashboard.sections.componentHealth.check',
        value:    'checkName',
        sort:     'checkName',
      },
      {
        name:          'message',
        labelKey:      'harvester.dashboard.sections.componentHealth.message',
        value:         'message',
        canBeVariable: true,
      },
      {
        name:          'affectedCount',
        labelKey:      'harvester.dashboard.sections.componentHealth.affectedCount',
        value:         'affectedCount',
        sort:          'affectedCount',
        width:         260,
        canBeVariable: true,
      },
      {
        align:         'right',
        name:          'lastUpdatedAt',
        labelKey:      'harvester.dashboard.sections.componentHealth.lastUpdatedAt',
        value:         'lastUpdatedAt',
        sort:          'lastUpdatedAt:desc',
        formatter:     'LiveDate',
        formatterOpts: { addSuffix: true },
        width:         140,
      },
      {
        align:    'right',
        name:     'actions',
        labelKey: 'harvester.dashboard.sections.componentHealth.actions',
        width:    120,
      },
    ];

    return {
      eventHeaders,
      componentHealthHeaders,
      healthSummaryHeaders,
      constraints:            [],
      events:                 [],
      nodeMetrics:            [],
      nodes:                  [],
      metricNodes:            [],
      vms:                    [],
      pvcs:                   [],
      componentHealths:       [],
      healthSummaries:        [],
      ignoreRules:            [],
      showIgnored:            false,
      ignoreForms:            {},
      ignoreErrors:           [],
      monitoring:             {},
      VM_DASHBOARD_METRICS_URL,
      CLUSTER_METRICS_SUMMARY_URL,
      CLUSTER_METRICS_DETAIL_URL,
      showClusterMetrics:     false,
      showVmMetrics:          false,
      enabledMonitoringAddon: false,
      hasLonghornSchema:      false,
      expandedMessageIds:     [],
      componentHealthFilters: {},
    };
  },

  computed: {
    ...mapGetters(['currentCluster']),

    accessibleResources() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return RESOURCES.filter((resource) => this.$store.getters[`${ inStore }/schemaFor`](resource.type));
    },

    totalCountGaugeInput() {
      const out = {};

      this.accessibleResources.forEach((resource) => {
        const counts = resourceCounts(this.$store, resource.type);

        out[resource.type] = { resource: resource.type };

        Object.entries(counts).forEach((entry) => {
          out[resource.type][entry[0]] = entry[1];
        });

        if (resource.spoofed) {
          if (resource.spoofed?.filterNamespace && Array.isArray(resource.spoofed.filterNamespace)) {
            const clusterCounts = this.$store.getters['harvester/all'](COUNT)[0].counts;
            const statistics = clusterCounts[resource.type] || {};

            for (let i = 0; i < resource.spoofed.filterNamespace.length; i++) {
              const nsStatistics = statistics?.namespaces?.[resource.spoofed.filterNamespace[i]] || {};

              if (nsStatistics.count) {
                out[resource.type]['useful'] -= nsStatistics.count;
                out[resource.type]['total'] -= nsStatistics.count;
              }
              Object.entries(nsStatistics?.states || {}).forEach((entry) => {
                const color = colorForState(entry[0]);
                const count = entry[1];
                const countName = colorToCountName(color);

                out[resource.type]['useful'] -= count;
                out[resource.type][countName] += count;
              });
            }
          }

          out[resource.type] = {
            ...out[resource.type],
            ...resource.spoofed,
            isSpoofed: true
          };

          out[resource.type].name = this.t(`typeLabel."${ resource.spoofed.name }"`, { count: out[resource.type].total });
        }

        if (resource.type === PVC) {
          // filter out the golden image volumes
          const goldenImageVolumeCount = (this.pvcs || []).filter((pvc) => pvc.isGoldenImageVolume).length;

          out[resource.type].useful = out[resource.type].useful - goldenImageVolumeCount;
          out[resource.type].total = out[resource.type].total - goldenImageVolumeCount;
        }

        if (resource.type === HCI.BLOCK_DEVICE) {
          let total = 0;
          let errorCount = 0;

          (this.nodes || []).map((node) => {
            total += node.diskStatusCount.total;
            errorCount += node.diskStatusCount.errorCount;
          });

          out[resource.type] = {
            ...out[resource.type],
            total,
            errorCount,
            useful: total - errorCount,
          };
        }
      });

      return out;
    },

    currentVersion() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const setting = this.$store.getters[`${ inStore }/byId`](HCI.SETTING, 'server-version');

      return setting?.value || setting?.default;
    },

    firstNodeCreationTimestamp() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const days = this.$store.getters[`${ inStore }/all`](NODE).map( (N) => {
        return dayjs(N.metadata.creationTimestamp);
      });

      if (!days.length) {
        return dayjs().utc().format();
      }

      return dayjs.min(days).utc().format();
    },

    cpusTotal() {
      let out = 0;

      this.metricNodes.forEach((node) => {
        out += node.cpuCapacity;
      });

      return out;
    },

    cpusUsageTotal() {
      let out = 0;

      this.metricNodes.forEach((node) => {
        out += node.cpuUsage;
      });

      return out;
    },

    memoryTotal() {
      let out = 0;

      this.metricNodes.forEach((node) => {
        out += node.memoryCapacity;
      });

      return out;
    },

    memoryUsageTotal() {
      let out = 0;

      this.metricNodes.forEach((node) => {
        out += node.memoryUsage;
      });

      return out;
    },

    storageStats() {
      const storageOverProvisioningPercentageSetting = this.longhornSettings.find((s) => s.id === 'longhorn-system/storage-over-provisioning-percentage');
      const stats = this.longhornNodes.reduce((total, node) => {
        const disks = node?.spec?.disks || {};
        const diskStatus = node?.status?.diskStatus || {};

        total.used += node?.spec?.allowScheduling ? node.used : 0;

        Object.keys(disks).map((key) => {
          total.scheduled += node?.spec?.allowScheduling ? (diskStatus[key]?.storageScheduled || 0) : 0;
          total.reserved += disks[key]?.storageReserved || 0;
        });
        Object.values(diskStatus).map((diskStat) => {
          total.maximum += diskStat?.storageMaximum || 0;
        });

        return total;
      }, {
        used:      0,
        scheduled: 0,
        maximum:   0,
        reserved:  0,
        total:     0
      });

      stats.total = ((stats.maximum - stats.reserved) * Number(storageOverProvisioningPercentageSetting?.value ?? 0)) / 100;

      return stats;
    },

    storageUsed() {
      const stats = this.storageStats;

      return this.createDisplayValues(stats.maximum, stats.used);
    },

    storageAllocated() {
      const stats = this.storageStats;

      return this.createDisplayValues(stats.total, stats.scheduled);
    },

    vmEvents() {
      return this.events.filter( (E) => ['VirtualMachineInstance', 'VirtualMachine'].includes(E.involvedObject.kind));
    },

    volumeEvents() {
      return this.events.filter( (E) => ['PersistentVolumeClaim'].includes(E.involvedObject.kind));
    },

    hostEvents() {
      return this.events.filter( (E) => ['Node'].includes(E.involvedObject.kind));
    },

    imageEvents() {
      return this.events.filter( (E) => ['VirtualMachineImage'].includes(E.involvedObject.kind));
    },

    healthSummaryRows() {
      const rows = [];

      (this.healthSummaries || []).forEach((healthSummary) => {
        const components = healthSummary?.status?.components || {};
        const lastUpdatedAt = healthSummary?.status?.lastUpdatedAt;

        Object.entries(components).forEach(([component, counts]) => {
          rows.push({
            id:           `${ healthSummary.id }/${ component }`,
            component,
            errorCount:   counts?.errorCount || 0,
            warningCount: counts?.warningCount || 0,
            lastUpdatedAt,
          });
        });
      });

      return rows;
    },

    componentHealthRows() {
      const rows = [];

      (this.componentHealths || []).forEach((componentHealth) => {
        const labels = componentHealth?.metadata?.labels || {};
        const component = labels[COMPONENT_LABEL] || componentHealth?.metadata?.name;
        const node = labels[NODE_LABEL] || '';
        const checks = componentHealth?.status?.checks || {};
        const lastUpdatedAt = componentHealth?.status?.lastUpdatedAt;

        Object.entries(checks).forEach(([checkName, check]) => {
          rows.push({
            id:                  `${ componentHealth.id }/${ checkName }`,
            component,
            componentHealthName: componentHealth.metadata?.name,
            node,
            checkName,
            ignored:             !!check.ignored,
            ignoredBy:           check.ignoredBy,
            severity:            check.severity,
            message:             check.message,
            affectedCount:       check.affectedCount,
            affectedResources:   check.affectedResources,
            lastUpdatedAt,
          });
        });
      });

      return rows;
    },

    componentHealthGroups() {
      const rowsByComponent = {};

      this.componentHealthRows.forEach((row) => {
        rowsByComponent[row.component] = rowsByComponent[row.component] || [];
        rowsByComponent[row.component].push(row);
      });

      const components = new Set(Object.keys(rowsByComponent));

      (this.componentHealths || []).forEach((componentHealth) => {
        const labels = componentHealth?.metadata?.labels || {};
        const component = labels[COMPONENT_LABEL] || componentHealth?.metadata?.name;

        components.add(component);
      });

      return Array.from(components).sort().map((component) => ({
        component,
        rows: rowsByComponent[component] || [],
      }));
    },

    hasMetricsTabs() {
      return this.showClusterMetrics || this.showVmMetrics;
    },

    pods() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const pods = this.$store.getters[`${ inStore }/all`](POD) || [];

      return pods.filter((p) => p?.metadata?.name !== 'removing');
    },

    cpuReserved() {
      const useful = this.nodes.reduce((total, node) => {
        return total + node.cpuReserved;
      }, 0);

      return {
        total: this.cpusTotal,
        useful,
      };
    },

    ramReserved() {
      const useful = this.nodes.reduce((total, node) => {
        return total + node.memoryReserved;
      }, 0);

      return this.createDisplayValues(this.memoryTotal, useful);
    },

    availableNodes() {
      return (this.metricNodes || []).map((node) => node.id);
    },

    metricAggregations() {
      const nodes = this.nodes;
      const someNonWorkerRoles = this.nodes.some((node) => node.hasARole && !node.isWorker);
      const metrics = this.nodeMetrics.filter((nodeMetrics) => {
        const node = nodes.find((nd) => nd.id === nodeMetrics.id);

        return node && (!someNonWorkerRoles || node.isWorker);
      });
      const initialAggregation = {
        cpu:    0,
        memory: 0
      };

      if (isEmpty(metrics)) {
        return null;
      }

      return metrics.reduce((agg, metric) => {
        agg.cpu += parseSi(metric.usage.cpu);
        agg.memory += parseSi(metric.usage.memory);

        return agg;
      }, initialAggregation);
    },

    cpuUsed() {
      return {
        total:  this.cpusTotal,
        useful: this.metricAggregations?.cpu,
      };
    },

    ramUsed() {
      return this.createDisplayValues(this.memoryTotal, this.metricAggregations?.memory);
    },

    hasMetricNodeSchema() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return !!this.$store.getters[`${ inStore }/schemaFor`](METRIC.NODE);
    },

    toEnableMonitoringAddon() {
      return `${ HCI.ADD_ONS }/cattle-monitoring-system/rancher-monitoring?mode=edit#alertmanager`;
    },

    canEnableMonitoringAddon() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const hasSchema = this.$store.getters[`${ inStore }/schemaFor`](HCI.ADD_ONS);

      return hasSchema && this.monitoring;
    },
  },

  methods: {
    createDisplayValues(total, useful) {
      const parsedTotal = parseSi((total || '0').toString());

      const parsedUseful = parseSi((useful || '0').toString());
      const format = this.createFormat(parsedTotal);

      const formattedTotal = formatSi(parsedTotal, format);
      let formattedUseful = formatSi(parsedUseful, {
        ...format,
        addSuffix: false,
      });

      if (!Number.parseFloat(formattedUseful) > 0) {
        formattedUseful = formatSi(parsedUseful, {
          ...format,
          canRoundToZero: false,
        });
      }

      return {
        total:  Number(parsedTotal),
        useful: Number(parsedUseful),
        formattedTotal,
        formattedUseful,
        units:  this.createUnits(parsedTotal),
      };
    },

    createFormat(n) {
      const exponent = exponentNeeded(n, PARSE_RULES.format.increment);

      return {
        ...PARSE_RULES.format,
        maxExponent: exponent,
        minExponent: exponent,
      };
    },

    createUnits(n) {
      const exponent = exponentNeeded(n, PARSE_RULES.format.increment);

      return `${ UNITS[exponent] }${ PARSE_RULES.format.suffix }`;
    },

    async fetchClusterResources(type, opt = {}, store) {
      const inStore = store || this.$store.getters['currentProduct'].inStore;

      const schema = this.$store.getters[`${ inStore }/schemaFor`](type);

      if (schema) {
        try {
          const resources = await this.$store.dispatch(`${ inStore }/findAll`, { type, opt });

          return resources;
        } catch (err) {
          console.error(`Failed fetching cluster resource ${ type } with error:`, err); // eslint-disable-line no-console

          return [];
        }
      }

      return [];
    },

    async loadMetrics() {
      this.nodeMetrics = await this.fetchClusterResources(METRIC.NODE, { force: true } );
    },

    severityColor(severity) {
      return SEVERITY_COLORS[severity] || 'bg-info';
    },

    healthSummarySeverity(row) {
      if (row.errorCount > 0) {
        return 'Critical';
      }

      if (row.warningCount > 0) {
        return 'Warning';
      }

      return 'Healthy';
    },

    affectedResourceKind(row) {
      const { apiVersion, kind } = row?.affectedResources || {};

      if (!kind) {
        return '';
      }

      return apiVersion ? `${ apiVersion }, ${ kind }` : kind;
    },

    allAffectedResourceNames(row) {
      return Object.keys(row?.affectedResources?.names || {});
    },

    // the resources that no HealthIgnoreRule ignores
    activeAffectedResourceNames(row) {
      const names = row?.affectedResources?.names || {};

      return Object.keys(names).filter((name) => !names[name]?.ignored);
    },

    affectedResourceNames(row) {
      return this.showIgnored ? this.allAffectedResourceNames(row) : this.activeAffectedResourceNames(row);
    },

    resourceIgnoredBy(row, name) {
      const detail = row?.affectedResources?.names?.[name];

      return detail?.ignored ? detail.ignoredBy : '';
    },

    truncatedAffectedResourceNames(row) {
      return this.affectedResourceNames(row).slice(0, AFFECTED_RESOURCES_TRUNCATE_COUNT);
    },

    remainingAffectedResourcesCount(row) {
      return Math.max(this.affectedResourceNames(row).length - AFFECTED_RESOURCES_TRUNCATE_COUNT, 0);
    },

    affectedResourcesTooltip(row) {
      return this.affectedResourceNames(row).join(', ');
    },

    componentHealthHeadersFor(rows) {
      const hasNode = (rows || []).some((row) => row.node);

      return this.componentHealthHeaders.filter((header) => header.name !== 'node' || hasNode);
    },

    truncatedMessage(message) {
      if (!message || message.length <= MESSAGE_TRUNCATE_LENGTH) {
        return message;
      }

      return message.slice(0, MESSAGE_TRUNCATE_LENGTH);
    },

    isMessageTruncated(message) {
      return !!message && message.length > MESSAGE_TRUNCATE_LENGTH;
    },

    isMessageExpanded(rowId) {
      return this.expandedMessageIds.includes(rowId);
    },

    toggleMessage(rowId) {
      if (this.isMessageExpanded(rowId)) {
        this.expandedMessageIds = this.expandedMessageIds.filter((id) => id !== rowId);
      } else {
        this.expandedMessageIds = [...this.expandedMessageIds, rowId];
      }
    },

    componentHealthFiltersFor(component) {
      return this.componentHealthFilters[component] || COMPONENT_HEALTH_SEVERITIES;
    },

    componentHealthSeverityFiltersFor(rows) {
      return COMPONENT_HEALTH_SEVERITIES.map((severity) => ({
        severity,
        count: rows.filter((row) => row.severity === severity && this.isRowVisible(row)).length,
      }));
    },

    isRowVisible(row) {
      return this.showIgnored || !row.ignored;
    },

    componentHealthRowsFor(component, rows) {
      return rows.filter((row) => this.isRowVisible(row) && this.componentHealthFiltersFor(component).includes(row.severity));
    },

    hasIgnoredRows(rows) {
      return (rows || []).some((row) => row.ignored || this.allAffectedResourceNames(row).length !== this.activeAffectedResourceNames(row).length);
    },

    ignoreFormFor(row) {
      return this.ignoreForms[row.id] || {
        scope:    this.activeAffectedResourceNames(row).length ? 'resources' : 'check',
        // null selects every resource, the ones that are not selected are kept visible
        selected: null,
        duration: 'days7',
        reason:   '',
      };
    },

    selectedIgnoreResources(row) {
      const { selected } = this.ignoreFormFor(row);
      const active = this.activeAffectedResourceNames(row);

      return selected === null ? active : active.filter((name) => selected.includes(name));
    },

    // a rule that lists no resource would ignore the entire check
    canIgnore(row) {
      return this.ignoreFormFor(row).scope === 'check' || this.selectedIgnoreResources(row).length > 0;
    },

    updateIgnoreForm(row, key, value) {
      this.ignoreForms = {
        ...this.ignoreForms,
        [row.id]: { ...this.ignoreFormFor(row), [key]: value },
      };
    },

    ignoreScopeOptions() {
      return [
        { label: this.t('harvester.dashboard.sections.componentHealth.ignore.scopeResources'), value: 'resources' },
        { label: this.t('harvester.dashboard.sections.componentHealth.ignore.scopeCheck'), value: 'check' },
      ];
    },

    ignoreDurationOptions() {
      return Object.keys(IGNORE_DURATION_DAYS).map((key) => ({
        label: this.t(`harvester.dashboard.sections.componentHealth.ignore.${ key }`),
        value: key,
      }));
    },

    ignoreRuleByName(name) {
      return (this.ignoreRules || []).find((rule) => rule.metadata?.name === name);
    },

    // the rules shipped by the addon values are managed by Helm, they are not removed from the dashboard
    canRestore(ignoredBy) {
      const rule = this.ignoreRuleByName(ignoredBy);

      return !!rule && rule.metadata?.labels?.[IGNORE_RULE_SOURCE_LABEL] !== 'default';
    },

    isMinSeverityIgnore(ignoredBy) {
      return ignoredBy === IGNORED_BY_MIN_SEVERITY;
    },

    async ignoreCheck(row, hide, buttonCb) {
      const form = this.ignoreFormFor(row);
      const spec = {
        componentHealth: row.componentHealthName,
        checkKey:        row.checkName,
      };

      // the rule only lists the selected resources, so it does not swallow the ones coming later
      if (form.scope === 'resources') {
        spec.resources = this.selectedIgnoreResources(row);
      }

      const days = IGNORE_DURATION_DAYS[form.duration];

      if (days) {
        spec.expiresAt = dayjs().add(days, 'day').toISOString();
      }

      if (form.reason) {
        spec.reason = form.reason;
      }

      try {
        const rule = await this.$store.dispatch('harvester/create', {
          type:     HCI.HEALTH_IGNORE_RULE,
          metadata: {
            generateName: 'ignore-',
            labels:       { [IGNORE_RULE_SOURCE_LABEL]: 'user' },
          },
          spec,
        });

        await rule.save();

        this.$store.dispatch('growl/success', {
          title:   this.t('generic.notification.title.succeed'),
          message: this.t('harvester.dashboard.sections.componentHealth.ignore.success', { name: row.checkName }),
        }, { root: true });

        this.ignoreErrors = [];
        buttonCb(true);
        hide();
      } catch (err) {
        this.ignoreErrors = exceptionToErrorsArray(err?.data || err);
        buttonCb(false);
      }
    },

    async restoreIgnored(ignoredBy) {
      const rule = this.ignoreRuleByName(ignoredBy);

      if (!rule) {
        return;
      }

      try {
        await rule.remove();

        this.$store.dispatch('growl/success', {
          title:   this.t('generic.notification.title.succeed'),
          message: this.t('harvester.dashboard.sections.componentHealth.ignore.restored'),
        }, { root: true });
      } catch (err) {
        this.$store.dispatch('growl/fromError', { title: this.t('generic.notification.title.error'), err }, { root: true });
      }
    },

    toggleComponentHealthSeverity(component, severity, enabled) {
      const filters = this.componentHealthFiltersFor(component);
      const updatedFilters = enabled ? [...filters, severity] : filters.filter((filter) => filter !== severity);

      this.componentHealthFilters = {
        ...this.componentHealthFilters,
        [component]: updatedFilters,
      };
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending || !currentCluster" />
  <section v-else>
    <HarvesterUpgrade />

    <div
      class="cluster-dashboard-glance"
    >
      <div>
        <label>
          {{ t('harvester.dashboard.version') }}:
        </label>
        <span>
          <span v-clean-tooltip="{content: currentVersion}">
            {{ currentVersion }}
          </span>
        </span>
      </div>
      <div>
        <label>
          {{ t('glance.created') }}:
        </label>
        <span>
          <LiveDate
            :value="firstNodeCreationTimestamp"
            :add-suffix="true"
            :show-tooltip="true"
          />
        </span>
      </div>
    </div>

    <div v-if="!enabledMonitoringAddon && canEnableMonitoringAddon">
      <Banner color="info">
        <MessageLink
          :to="toEnableMonitoringAddon"
          prefix-label="harvester.monitoring.alertmanagerConfig.disabledAddon.prefix"
          middle-label="harvester.monitoring.alertmanagerConfig.disabledAddon.middle"
          suffix-label="harvester.monitoring.alertmanagerConfig.disabledAddon.suffix"
        />
      </Banner>
    </div>

    <div class="resource-gauges">
      <ResourceSummary
        v-for="(resource, i) in totalCountGaugeInput"
        :key="i"
        :spoofed-counts="resource.isSpoofed ? resource : null"
        :resource="resource.resource"
      />
    </div>

    <template v-if="nodes.length && hasMetricNodeSchema">
      <h3 class="mt-40">
        {{ t('clusterIndexPage.sections.capacity.label') }}
      </h3>
      <div
        class="hardware-resource-gauges"
        :class="{
          live: !hasLonghornSchema,
        }"
      >
        <HardwareResourceGauge
          :name="t('harvester.dashboard.hardwareResourceGauge.cpu')"
          :reserved="cpuReserved"
          :used="cpuUsed"
        />
        <HardwareResourceGauge
          :name="t('harvester.dashboard.hardwareResourceGauge.memory')"
          :reserved="ramReserved"
          :used="ramUsed"
        />
        <HardwareResourceGauge
          v-if="hasLonghornSchema"
          :name="t('harvester.dashboard.hardwareResourceGauge.storage')"
          :used="storageUsed"
          :reserved="storageAllocated"
          :reserved-title="t('harvester.dashboard.hardwareResourceGauge.allocated')"
        />
      </div>
    </template>

    <Tabbed
      v-if="hasMetricsTabs && enabledMonitoringAddon"
      class="mt-30"
    >
      <Tab
        v-if="showClusterMetrics"
        name="cluster-metrics"
        :label="t('clusterIndexPage.sections.clusterMetrics.label')"
        :weight="99"
      >
        <template #default="props">
          <DashboardMetrics
            v-if="props.active"
            :detail-url="CLUSTER_METRICS_DETAIL_URL"
            :summary-url="CLUSTER_METRICS_SUMMARY_URL"
            graph-height="825px"
          />
        </template>
      </Tab>
      <Tab
        v-if="showVmMetrics"
        name="vm-metric"
        :label="t('harvester.dashboard.sections.vmMetrics.label')"
        :weight="98"
      >
        <template #default="props">
          <DashboardMetrics
            v-if="props.active"
            :detail-url="VM_DASHBOARD_METRICS_URL"
            graph-height="825px"
            :has-summary-and-detail="false"
          />
        </template>
      </Tab>
    </Tabbed>

    <div class="mb-40 mt-40">
      <h3>
        {{ t('clusterIndexPage.sections.events.label') }}
      </h3>
      <Tabbed class="mt-20">
        <Tab
          name="host"
          label="Hosts"
          :weight="98"
        >
          <SortableTable
            :rows="hostEvents"
            :headers="eventHeaders"
            key-field="id"
            :search="false"
            :table-actions="false"
            :row-actions="false"
            :paging="true"
            :rows-per-page="10"
            default-sort-by="date"
          >
            <template #cell:resource="{row, value}">
              <div class="text-info">
                {{ value }}
              </div>
              <div v-if="row.message">
                {{ row.displayMessage }}
              </div>
            </template>
          </SortableTable>
        </Tab>
        <Tab
          name="vm"
          label="VMs"
          :weight="99"
        >
          <SortableTable
            :rows="vmEvents"
            :headers="eventHeaders"
            key-field="id"
            :search="false"
            :table-actions="false"
            :row-actions="false"
            :paging="true"
            :rows-per-page="10"
            default-sort-by="date"
          >
            <template #cell:resource="{row, value}">
              <div class="text-info">
                {{ value }}
              </div>
              <div v-if="row.message">
                {{ row.displayMessage }}
              </div>
            </template>
          </SortableTable>
        </Tab>
        <Tab
          name="volume"
          label="Volumes"
          :weight="97"
        >
          <SortableTable
            :rows="volumeEvents"
            :headers="eventHeaders"
            key-field="id"
            :search="false"
            :table-actions="false"
            :row-actions="false"
            :paging="true"
            :rows-per-page="10"
            default-sort-by="date"
          >
            <template #cell:resource="{row, value}">
              <div class="text-info">
                {{ value }}
              </div>
              <div v-if="row.message">
                {{ row.displayMessage }}
              </div>
            </template>
          </SortableTable>
        </Tab>
        <Tab
          name="image"
          label="Images"
          :weight="96"
        >
          <SortableTable
            :rows="imageEvents"
            :headers="eventHeaders"
            key-field="id"
            :search="false"
            :table-actions="false"
            :row-actions="false"
            :paging="true"
            :rows-per-page="10"
            default-sort-by="date"
          >
            <template #cell:resource="{row, value}">
              <div class="text-info">
                {{ value }}
              </div>
              <div v-if="row.message">
                {{ row.displayMessage }}
              </div>
            </template>
          </SortableTable>
        </Tab>
      </Tabbed>
    </div>

    <div
      v-if="healthSummaryRows.length"
      class="mb-40 mt-40"
    >
      <h3>
        {{ t('harvester.dashboard.sections.healthSummary.label') }}
      </h3>
      <SortableTable
        :rows="healthSummaryRows"
        :headers="healthSummaryHeaders"
        key-field="id"
        :search="false"
        :table-actions="false"
        :row-actions="false"
        :paging="true"
        :rows-per-page="10"
        default-sort-by="severity"
      >
        <template #cell:severity="{row}">
          <BadgeState
            :color="severityColor(healthSummarySeverity(row))"
            :label="healthSummarySeverity(row)"
          />
        </template>
      </SortableTable>
    </div>

    <div
      v-if="componentHealthGroups.length"
      class="mb-40 mt-40"
    >
      <h3>
        {{ t('harvester.dashboard.sections.componentHealth.label') }}
      </h3>
      <Tabbed
        class="mt-20"
        :side-tabs="true"
        :use-hash="false"
      >
        <Tab
          v-for="group in componentHealthGroups"
          :key="group.component"
          :name="group.component"
          :label="group.component"
        >
          <div class="component-health-filter mb-20">
            <v-dropdown
              popper-class="component-health-filter-dropdown"
              :triggers="['click']"
              placement="bottom-start"
              :distance="20"
            >
              <button class="btn bg-primary">
                {{ t('harvester.dashboard.sections.componentHealth.filter') }}
              </button>

              <template #popper>
                <div class="filter-popup">
                  <Checkbox
                    v-for="filter in componentHealthSeverityFiltersFor(group.rows)"
                    :key="filter.severity"
                    :value="componentHealthFiltersFor(group.component).includes(filter.severity)"
                    type="checkbox"
                    :label="`${ filter.severity } (${ filter.count })`"
                    @update:value="toggleComponentHealthSeverity(group.component, filter.severity, $event)"
                  />
                </div>
              </template>
            </v-dropdown>
            <Checkbox
              v-if="hasIgnoredRows(group.rows)"
              v-model:value="showIgnored"
              class="ml-20"
              type="checkbox"
              :label="t('harvester.dashboard.sections.componentHealth.showIgnored')"
            />
          </div>
          <div
            v-if="!componentHealthRowsFor(group.component, group.rows).length"
            class="text-muted"
          >
            {{ t('harvester.dashboard.sections.componentHealth.noIssues') }}
          </div>
          <SortableTable
            v-else
            :rows="componentHealthRowsFor(group.component, group.rows)"
            :headers="componentHealthHeadersFor(componentHealthRowsFor(group.component, group.rows))"
            key-field="id"
            :search="false"
            :table-actions="false"
            :row-actions="false"
            :paging="true"
            :rows-per-page="10"
            default-sort-by="severity"
          >
            <template #cell:severity="{row}">
              <BadgeState
                :color="severityColor(row.severity)"
                :label="row.severity"
              />
            </template>
            <template #cell:actions="{row}">
              <div v-if="row.ignored">
                <a
                  v-if="canRestore(row.ignoredBy)"
                  class="text-info"
                  @click="restoreIgnored(row.ignoredBy)"
                >
                  {{ t('harvester.dashboard.sections.componentHealth.ignore.restore') }}
                </a>
                <span
                  v-else-if="isMinSeverityIgnore(row.ignoredBy)"
                  v-clean-tooltip="t('harvester.dashboard.sections.componentHealth.ignore.minSeverity')"
                  class="text-muted"
                >
                  {{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }}
                </span>
                <span
                  v-else
                  v-clean-tooltip="t('harvester.dashboard.sections.componentHealth.ignore.managedByAddon')"
                  class="text-muted"
                >
                  {{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }}
                </span>
              </div>
              <v-dropdown
                v-else
                :triggers="['click']"
                placement="bottom-end"
                :distance="10"
              >
                <button class="btn btn-sm role-secondary">
                  {{ t('harvester.dashboard.sections.componentHealth.ignore.action') }}
                </button>

                <template #popper="{ hide }">
                  <div class="ignore-popup">
                    <RadioGroup
                      v-if="activeAffectedResourceNames(row).length"
                      :name="`ignore-scope-${ row.id }`"
                      :value="ignoreFormFor(row).scope"
                      :label="t('harvester.dashboard.sections.componentHealth.ignore.scope')"
                      :options="ignoreScopeOptions()"
                      @update:value="updateIgnoreForm(row, 'scope', $event)"
                    />
                    <LabeledSelect
                      v-if="ignoreFormFor(row).scope === 'resources' && activeAffectedResourceNames(row).length"
                      :value="selectedIgnoreResources(row)"
                      :label="t('harvester.dashboard.sections.componentHealth.ignore.resources')"
                      :options="activeAffectedResourceNames(row)"
                      :multiple="true"
                      :close-on-select="false"
                      :clearable="false"
                      :append-to-body="false"
                      @update:value="updateIgnoreForm(row, 'selected', $event)"
                    />
                    <RadioGroup
                      :name="`ignore-duration-${ row.id }`"
                      :value="ignoreFormFor(row).duration"
                      :label="t('harvester.dashboard.sections.componentHealth.ignore.duration')"
                      :options="ignoreDurationOptions()"
                      @update:value="updateIgnoreForm(row, 'duration', $event)"
                    />
                    <LabeledInput
                      :value="ignoreFormFor(row).reason"
                      :label="t('harvester.dashboard.sections.componentHealth.ignore.reason')"
                      :placeholder="t('harvester.dashboard.sections.componentHealth.ignore.reasonPlaceholder')"
                      @update:value="updateIgnoreForm(row, 'reason', $event)"
                    />
                    <Banner
                      v-for="(err, i) in ignoreErrors"
                      :key="i"
                      color="error"
                      :label="err"
                    />
                    <div class="text-right">
                      <AsyncButton
                        mode="apply"
                        :action-label="t('harvester.dashboard.sections.componentHealth.ignore.action')"
                        :disabled="!canIgnore(row)"
                        @click="ignoreCheck(row, hide, $event)"
                      />
                    </div>
                  </div>
                </template>
              </v-dropdown>
            </template>
            <template #cell:node="{value}">
              {{ value || '-' }}
            </template>
            <template #cell:message="{row, value}">
              <span>
                {{ isMessageExpanded(row.id) ? value : truncatedMessage(value) }}
                <a
                  v-if="isMessageTruncated(value)"
                  class="text-info"
                  @click="toggleMessage(row.id)"
                >
                  {{ isMessageExpanded(row.id) ? t('harvester.generic.hideMore') : t('harvester.generic.showMore') }}
                </a>
              </span>
            </template>
            <template #cell:affectedCount="{row, value}">
              <div v-if="affectedResourceNames(row).length">
                <div class="text-muted">
                  {{ affectedResourceKind(row) }} ({{ value }})
                </div>
                <div
                  v-for="name in truncatedAffectedResourceNames(row)"
                  :key="name"
                  :class="{ 'text-muted': resourceIgnoredBy(row, name) }"
                >
                  {{ name }}
                  <span v-if="resourceIgnoredBy(row, name)">
                    ({{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }}<template v-if="canRestore(resourceIgnoredBy(row, name))">,
                      <a
                        class="text-info"
                        @click="restoreIgnored(resourceIgnoredBy(row, name))"
                      >{{ t('harvester.dashboard.sections.componentHealth.ignore.restore') }}</a></template>)
                  </span>
                </div>
                <div
                  v-if="remainingAffectedResourcesCount(row)"
                  v-clean-tooltip="affectedResourcesTooltip(row)"
                  class="text-info"
                >
                  {{ t('harvester.dashboard.sections.componentHealth.moreAffectedResources', { count: remainingAffectedResourcesCount(row) }) }}
                </div>
              </div>
              <span v-else>
                {{ t('harvester.dashboard.sections.componentHealth.noAffectedResources') }}
              </span>
            </template>
          </SortableTable>
        </Tab>
      </Tabbed>
    </div>
  </section>
</template>

<style lang="scss" scoped>
  .cluster-dashboard-glance {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 20px 0px;
    display: flex;

    &>*{
      margin-right: 40px;

      & SPAN {
        font-weight: bold
      }
    }
  }

  .events {
    margin-top: 30px;
  }

  .component-health-filter {
    display: flex;
    align-items: center;
  }

  .ignore-popup {
    display: grid;
    gap: 10px;
    padding: 10px;
    min-width: 320px;
  }

  .component-health-filter-dropdown .filter-popup {
    display: grid;
    gap: 10px;
    padding: 10px;
  }
</style>
