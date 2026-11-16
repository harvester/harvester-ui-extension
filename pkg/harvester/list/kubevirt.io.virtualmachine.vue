<script>
import { mapGetters } from 'vuex';
import ResourceTable from '@shell/components/ResourceTable';
import PaginatedResourceTable from '@shell/components/PaginatedResourceTable';
import { STATE, AGE, NAME, NAMESPACE } from '@shell/config/table-headers';
import {
  PVC, PV, NODE, POD, STORAGE_CLASS
} from '@shell/config/types';
import { FilterArgs, PaginationFilterEquality, PaginationParamFilter } from '@shell/types/store/pagination.types';

import { allHash } from '@shell/utils/promise';
import { uniq } from '@shell/utils/array';
import Loading from '@shell/components/Loading';
import { clone } from '@shell/utils/object';
import { HCI } from '../types';
import { HCI as HCI_ANNOTATIONS } from '../config/labels-annotations';
import { VM_LIST_PAGINATION_CONTEXT } from '../config/harvester';
import HarvesterVmState from '../formatters/HarvesterVmState';
import ConsoleBar from '../components/VMConsoleBar';

const ENCRYPTED_VOLUME_TOOLTIP_KEYS = {
  all:     'harvester.virtualMachine.volume.lockTooltip.all',
  partial: 'harvester.virtualMachine.volume.lockTooltip.partial',
};

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
  {
    ...AGE,
    sort: 'metadata.creationTimestamp:desc',
  }
];

function paginationContext(store) {
  return store.getters['harvester-common/getFeatureEnabled']('vmListPagination') ? VM_LIST_PAGINATION_CONTEXT : null;
}

function canPaginate(store) {
  const context = paginationContext(store);
  const inStore = store.getters['currentProduct']?.inStore;

  // An API served from the SQL cache lists the printer columns of a CRD as `metadata.fields[N]`. Without the SQL cache
  // it can't filter the paged list, so don't rely on the version alone (it can be missing or not semver)
  const columns = store.getters[`${ inStore }/schemaFor`]?.(HCI.VM)?.attributes?.columns || [];
  const fromSqlCache = columns.some((col) => col.field?.startsWith('$.metadata.fields['));

  return !!context && fromSqlCache && !!store.getters[`${ inStore }/paginationEnabled`]?.({ id: HCI.VM, context });
}

// The API indexes the printer columns of a CRD by position (`metadata.fields.N`), so look the position up by name
function printerColumnField(schema, columnName) {
  const column = schema?.attributes?.columns?.find((col) => col.name === columnName);

  return column?.field?.replace('$.', '').replace('[', '.').replace(']', '');
}

// With server-side pagination the API sorts and searches, so only fields it indexes can be used.
// CPU, memory, IP and node are computed by the VM model or come from other resources.
function paginationHeaders(headers, schema) {
  const statusField = printerColumnField(schema, 'Status');

  return headers.map((header) => {
    switch (header.name) {
    case STATE.name:
      return {
        ...header, sort: statusField ? [statusField] : false, search: false
      };
    case NAME.name:
      return {
        ...header,
        sort:   ['metadata.name'],
        search: ['metadata.name', `metadata.annotations[${ HCI_ANNOTATIONS.VM_DISPLAY_NAME }]`],
      };
    case NAMESPACE.name:
      return {
        ...header, sort: ['metadata.namespace'], search: 'metadata.namespace'
      };
    case AGE.name:
      return { ...header, search: false };
    default:
      return {
        ...header, sort: false, search: false
      };
    }
  });
}

export default {
  name:       'HarvesterListVM',
  components: {
    Loading,
    HarvesterVmState,
    ConsoleBar,
    ResourceTable,
    PaginatedResourceTable
  },

  props: {
    schema: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    // PaginatedResourceTable fetches the VMs and calls fetchSecondaryResources / fetchPageSecondaryResources
    if (this.canPaginate) {
      return;
    }

    const inStore = this.inStore;
    const _hash = {
      vms:     this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VM, opt: { force: true } }),
      pod:     this.$store.dispatch(`${ inStore }/findAll`, { type: POD }),
      pvcs:    this.$store.dispatch(`${ inStore }/findAll`, { type: PVC }),
      pvs:     this.$store.dispatch(`${ inStore }/findAll`, { type: PV }),
      images:  this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IMAGE }),
      restore: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.RESTORE }),
      backups: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.BACKUP }),
      storage: this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS }),
    };

    if (this.$store.getters[`${ inStore }/schemaFor`](HCI.RESOURCE_QUOTA)) {
      _hash.resourceQuotas = this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.RESOURCE_QUOTA });
    }

    if (this.hasNode) {
      _hash.nodes = this.$store.dispatch(`${ inStore }/findAll`, { type: NODE });
    }

    const hash = await allHash(_hash);

    this.allVMs = hash.vms;
  },

  data() {
    return {
      allVMs:                       [],
      allVMIs:                      [],
      restartNotificationDisplayed: false,
      HCI
    };
  },

  computed: {
    ...mapGetters({ actionCb: 'action-menu/performCallbackData' }),

    inStore() {
      return this.$store.getters['currentProduct'].inStore;
    },

    hasNode() {
      return !!this.$store.getters[`${ this.inStore }/schemaFor`](NODE);
    },

    paginationContext() {
      return paginationContext(this.$store);
    },

    canPaginate() {
      return canPaginate(this.$store);
    },

    tableComponent() {
      return this.canPaginate ? PaginatedResourceTable : ResourceTable;
    },

    tableProps() {
      if (!this.canPaginate) {
        return { rows: this.rows };
      }

      return {
        context:                     this.paginationContext,
        paginationHeaders:           paginationHeaders(this.headers, this.schema),
        fetchSecondaryResources:     this.fetchSecondaryResources,
        fetchPageSecondaryResources: this.fetchPageSecondaryResources,
      };
    },

    // With pagination the store only holds the VMs of the current page
    vms() {
      return this.canPaginate ? this.$store.getters[`${ this.inStore }/all`](HCI.VM) : this.allVMs;
    },

    headers() {
      const restoreCol = {
        name:      'restoreProgress',
        labelKey:  'harvester.tableHeaders.restore',
        value:     'restoreProgress',
        align:     'left',
        formatter: 'HarvesterBackupProgressBar',
        width:     200,
      };
      const nodeCol = {
        name:      'node',
        label:     'Node',
        value:     'nodeName',
        sort:      ['realAttachNodeName'],
        formatter: 'HarvesterHost',
        labelKey:  'harvester.tableHeaders.vm.node'
      };

      const cols = clone(VM_HEADERS);

      if (this.hasNode) {
        cols.splice(-1, 0, nodeCol);
      }

      if (this.hasBackUpRestoreInProgress) {
        cols.splice(-1, 0, restoreCol);
      }

      return cols;
    },

    rows() {
      // The paginated API lists VMs only, so VMIs without a VM aren't shown then
      if (this.canPaginate) {
        return this.vms;
      }

      const vmIds = new Set(this.allVMs.map((VM) => VM.id));
      const matchVMIs = this.allVMIs.filter((VMI) => !vmIds.has(VMI.id));

      return [...this.allVMs, ...matchVMIs];
    },

    /**
     * We want to show the progress bar only for Backup's restore; snapshot's restore is immediate.
     */
    hasBackUpRestoreInProgress() {
      return this.rows.some((r) => {
        const restore = r.restoreResource;

        return restore && !restore.fromSnapshot && !restore.isComplete;
      });
    },

    vmRestartRequiredNames() {
      return this.vms
        .filter((vm) => vm.isRestartRequired)
        .map((vm) => vm.metadata.name);
    }
  },

  async created() {
    if (this.canPaginate) {
      return;
    }

    const inStore = this.inStore;
    const vmis = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VMI });

    await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VMIM });

    this['allVMIs'] = vmis;
  },

  beforeUnmount() {
    // clear restart message before component unmount
    this.$store.dispatch('growl/clear');
  },

  watch: {
    actionCb(neu) {
      if (neu?.clearTableSelection) {
        this.$refs.resourceTable.clearSelection();
        this.$store.dispatch('action-menu/clearCallbackData');
      }
    },

    vmRestartRequiredNames(vmNames, oldNames = []) {
      const count = vmNames.length;

      if (count === 0 && this.restartNotificationDisplayed) {
        this.restartNotificationDisplayed = false;

        return;
      }

      // The names are rebuilt on every refresh, and when paging on every page, sort and search too, so only notify when they change
      if ([...vmNames].sort().join() === [...oldNames].sort().join()) {
        return;
      }

      if (count > 0) {
        // clear old notification before showing new one
        if (this.restartNotificationDisplayed) {
          this.$store.dispatch('growl/clear');
        }

        this.$store.dispatch('growl/warning', {
          title:   this.t('harvester.notification.restartRequired.title', { count }),
          message: this.t('harvester.notification.restartRequired.message', { vmNames: vmNames.join(', ') }),
          timeout: 10000,
        }, { root: true });
        this.restartNotificationDisplayed = true;
      }
    }
  },
  methods: {
    lockIconTooltipMessage(row) {
      const key = ENCRYPTED_VOLUME_TOOLTIP_KEYS[row.encryptedVolumeType];

      return key ? this.t(key) : '';
    },

    async fetchSecondaryResources() {
      const inStore = this.inStore;
      const hash = {
        images:  this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IMAGE }),
        storage: this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS }),
      };

      if (this.$store.getters[`${ inStore }/schemaFor`](HCI.RESOURCE_QUOTA)) {
        hash.resourceQuotas = this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.RESOURCE_QUOTA });
      }

      if (this.hasNode) {
        hash.nodes = this.$store.dispatch(`${ inStore }/findAll`, { type: NODE });
      }

      await allHash(hash);
    },

    // The VM model looks these up by id or owner, so the ones of the VMs on the page are enough
    async fetchPageSecondaryResources({ force, page }) {
      if (!page?.length) {
        return;
      }

      const vmNames = uniq(page.map((vm) => vm.metadata.name));
      const claimNames = uniq(page.flatMap((vm) => vm.persistentVolumeClaimName));

      // One failed request shouldn't stop the others, the rows show what could be loaded
      const loaded = (results) => results.map((result) => (result.status === 'fulfilled' ? result.value : []));

      const [pvcs, restores] = loaded(await Promise.allSettled([
        this.findPageByField(PVC, 'metadata.name', claimNames, force),
        this.findPageByField(HCI.RESTORE, this.printerColumnField(HCI.RESTORE, 'TARGET_NAME'), vmNames, force),
        this.findPageByField(HCI.VMI, 'metadata.name', vmNames, force),
        this.findPageByField(POD, `metadata.labels[${ HCI_ANNOTATIONS.VM_NAME }]`, vmNames, force),
        this.findPageByField(HCI.VMIM, this.printerColumnField(HCI.VMIM, 'VMI'), vmNames, force),
      ]));

      await Promise.allSettled([
        this.findPageByField(PV, 'metadata.name', uniq(pvcs.map((pvc) => pvc.spec?.volumeName)), force),
        this.findPageByField(HCI.BACKUP, 'metadata.name', uniq(restores.map((restore) => restore.spec?.virtualMachineBackupName)), force),
      ]);
    },

    async findPageByField(type, field, values, force) {
      const wanted = values.filter(Boolean);

      if (!field || !wanted.length || !this.$store.getters[`${ this.inStore }/schemaFor`](type)) {
        return [];
      }

      return this.$store.dispatch(`${ this.inStore }/findPage`, {
        type,
        opt: {
          force,
          pagination: new FilterArgs({
            filters: PaginationParamFilter.createSingleField({
              field, value: wanted.join(','), equality: PaginationFilterEquality.IN
            })
          }),
        }
      });
    },

    printerColumnField(type, columnName) {
      return printerColumnField(this.$store.getters[`${ this.inStore }/schemaFor`](type), columnName);
    }
  },

  // With pagination the store never holds every VM, so the masthead's loading count would never finish
  $loadingResources(route, store) {
    return canPaginate(store) ? { loadResources: [] } : {};
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <component
      :is="tableComponent"
      ref="resourceTable"
      v-bind="{ ...$attrs, ...tableProps }"
      :headers="headers"
      default-sort-by="age"
      :schema="schema"
      :groupable="true"
      key-field="_key"
    >
      <template
        #cell:state="scope"
        class="state-col"
      >
        <div class="state">
          <HarvesterVmState
            class="vmstate"
            :row="scope.row"
          />
        </div>
      </template>

      <template #cell:name="scope">
        <div class="name-console">
          <router-link
            v-if="scope.row.type !== HCI.VMI"
            :to="scope.row.detailLocation"
          >
            {{ scope.row.nameDisplay }}
            <i
              v-if="scope.row.encryptedVolumeType !== 'none'"
              v-tooltip="lockIconTooltipMessage(scope.row)"
              class="icon icon-lock"
              :class="{'green-icon': scope.row.encryptedVolumeType === 'all', 'yellow-icon': scope.row.encryptedVolumeType === 'partial'}"
            />
          </router-link>
          <span v-else>
            {{ scope.row.nameDisplay }}
          </span>
          <ConsoleBar
            :resource-type="scope.row"
            class="console mr-10 ml-10"
          />
        </div>
      </template>
    </component>
  </div>
</template>

<style lang="scss">
.growl-container {
  z-index: 56 !important;  // set to be lower than the vm action menu (z-index: 57)
}
</style>

<style lang="scss" scoped>
.state {
  display: flex;

  .vmstate {
    margin-right: 6px;
  }
}

.green-icon {
  color: var(--success);
}

.yellow-icon {
  color: var(--warning);
}

.name-console {
  display: flex;
  align-items: center;
  justify-content: space-between;

  span {
    padding-right: 4px;
    line-height: 26px;
    white-space: nowrap;
  }
}
</style>
