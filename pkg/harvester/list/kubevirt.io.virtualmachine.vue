<script>
import { mapGetters } from 'vuex';
import PaginatedResourceTable from '@shell/components/PaginatedResourceTable';
import IconMessage from '@shell/components/IconMessage';
import {
  PVC, PV, NODE, POD, STORAGE_CLASS
} from '@shell/config/types';
import { FilterArgs, PaginationFilterEquality, PaginationParamFilter } from '@shell/types/store/pagination.types';

import { allHash } from '@shell/utils/promise';
import paginationUtils from '@shell/utils/pagination-utils';
import { uniq } from '@shell/utils/array';
import { HCI } from '../types';
import { HCI as HCI_ANNOTATIONS } from '../config/labels-annotations';
import HarvesterVmState from '../formatters/HarvesterVmState';
import ConsoleBar from '../components/VMConsoleBar';

const ENCRYPTED_VOLUME_TOOLTIP_KEYS = {
  all:     'harvester.virtualMachine.volume.lockTooltip.all',
  partial: 'harvester.virtualMachine.volume.lockTooltip.partial',
};

// Outside the component because `ResourceList` calls `$loadingResources(route, store)` on the component options,
// where there's no `this`. The store's getter knows whether this cluster's API can page the list
function canPaginate(store) {
  const inStore = store.getters['currentProduct']?.inStore;

  return !!store.getters[`${ inStore }/paginationEnabled`]?.(HCI.VM);
}

export default {
  name:       'HarvesterListVM',
  components: {
    HarvesterVmState,
    ConsoleBar,
    IconMessage,
    PaginatedResourceTable
  },

  props: {
    schema: {
      type:     Object,
      required: true,
    },
  },

  data() {
    return {
      restartNotificationKey: '',
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

    canPaginate() {
      return canPaginate(this.$store);
    },

    // The header's namespace filter is shared by every list, so an option the paged API can't filter by, like Not in a
    // Project, can still be selected from another list. Ask for another one, like the shell's generic lists do
    namespaceFilterInvalid() {
      return this.canPaginate && !paginationUtils.validateNsProjectFilters(this.$store.getters['namespaceFilters']);
    },

    // The product registers both sets of VM columns (`headers()` in config/harvester-cluster.js)
    paginationHeaders() {
      return this.applicableColumns(this.$store.getters['type-map/headersFor'](this.schema, true));
    },

    // With pagination the store only holds the VMs of the current page
    vms() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.VM);
    },

    // The paginated API lists VMs only, so VMIs without a VM are only shown without pagination
    vmisWithoutVM() {
      if (this.canPaginate) {
        return [];
      }

      const vmIds = new Set(this.vms.map((vm) => vm.id));

      return this.$store.getters[`${ this.inStore }/all`](HCI.VMI).filter((vmi) => !vmIds.has(vmi.id));
    },

    headers() {
      return this.applicableColumns(this.$store.getters['type-map/headersFor'](this.schema, false));
    },

    rows() {
      return [...this.vms, ...this.vmisWithoutVM];
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

    restartRequiredVMs() {
      // While paging, the store can still hold the VMs another view loaded, like every VM after Volumes or a VM's detail
      if (this.canPaginate && !this.$store.getters[`${ this.inStore }/havePage`](HCI.VM)) {
        return [];
      }

      return this.vms.filter((vm) => vm.isRestartRequired);
    }
  },

  beforeUnmount() {
    // clear restart message before component unmount
    this.$store.dispatch('growl/clear');
  },

  watch: {
    actionCb(neu) {
      if (neu?.clearTableSelection) {
        this.$refs.resourceTable?.clearSelection();
        this.$store.dispatch('action-menu/clearCallbackData');
      }
    },

    restartRequiredVMs: {
      // Immediate, as the store may already hold the VMs when coming back to the list
      immediate: true,
      handler(vms) {
        // Rebuilt on every refresh, and when paging on every page, sort and search too, so only notify when the VMs
        // change. The key lives on the component, so coming back to the list notifies again
        const key = vms.map((vm) => vm.id).sort().join();

        if (key === this.restartNotificationKey) {
          return;
        }

        const shown = !!this.restartNotificationKey;

        this.restartNotificationKey = key;

        if (!vms.length) {
          return;
        }

        // clear old notification before showing new one
        if (shown) {
          this.$store.dispatch('growl/clear');
        }

        this.$store.dispatch('growl/warning', {
          title:   this.t('harvester.notification.restartRequired.title', { count: vms.length }),
          message: this.t('harvester.notification.restartRequired.message', { vmNames: vms.map((vm) => vm.metadata.name).join(', ') }),
          timeout: 10000,
        }, { root: true });
      }
    }
  },
  methods: {
    lockIconTooltipMessage(row) {
      const key = ENCRYPTED_VOLUME_TOOLTIP_KEYS[row.encryptedVolumeType];

      return key ? this.t(key) : '';
    },

    // Called by PaginatedResourceTable before it loads the VMs. With pagination fetchPageSecondaryResources loads the
    // resources of the VMs on the page, without it every VM needs its pods, volumes, restores, backups, VMI and migration
    async fetchSecondaryResources({ canPaginate }) {
      const inStore = this.inStore;
      const findAll = (type) => this.$store.dispatch(`${ inStore }/findAll`, { type });
      const hash = {
        images:  findAll(HCI.IMAGE),
        storage: findAll(STORAGE_CLASS),
      };

      if (this.$store.getters[`${ inStore }/schemaFor`](HCI.RESOURCE_QUOTA)) {
        hash.resourceQuotas = findAll(HCI.RESOURCE_QUOTA);
      }

      if (this.hasNode) {
        hash.nodes = findAll(NODE);
      }

      if (!canPaginate) {
        Object.assign(hash, {
          pods:     findAll(POD),
          pvcs:     findAll(PVC),
          pvs:      findAll(PV),
          restores: findAll(HCI.RESTORE),
          backups:  findAll(HCI.BACKUP),
          vmis:     findAll(HCI.VMI),
          vmims:    findAll(HCI.VMIM),
        });
      }

      await allHash(hash);
    },

    // The node column only when the cluster's nodes can be seen, the restore progress only while a backup is restored
    applicableColumns(headers) {
      return headers.filter(({ name }) => {
        if (name === 'node') {
          return this.hasNode;
        }

        if (name === 'restoreProgress') {
          return this.hasBackUpRestoreInProgress;
        }

        return true;
      });
    },

    // localFilter of PaginatedResourceTable, which only runs without pagination
    addVMIsWithoutVM(rows) {
      return [...rows, ...this.vmisWithoutVM];
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

      const [pvcs, restores, vmis] = loaded(await Promise.allSettled([
        this.findPageByField(PVC, 'metadata.name', claimNames, force),
        this.findPageByField(HCI.RESTORE, this.printerColumnField(HCI.RESTORE, 'TARGET_NAME'), vmNames, force),
        this.findPageByField(HCI.VMI, 'metadata.name', vmNames, force),
        this.findPageByField(HCI.VMIM, this.printerColumnField(HCI.VMIM, 'VMI'), vmNames, force),
      ]));

      await Promise.allSettled([
        this.findPageByField(PV, 'metadata.name', uniq(pvcs.map((pvc) => pvc.spec?.volumeName)), force),
        this.findPageByField(HCI.BACKUP, 'metadata.name', uniq(restores.map((restore) => restore.spec?.virtualMachineBackupName)), force),
        // KubeVirt labels every launcher pod with its VMI's UID; Harvester's vmName label is missing on VMs from Forklift or plain manifests
        this.findPageByField(POD, `metadata.labels[${ HCI_ANNOTATIONS.VMI_CREATED_BY }]`, uniq(vmis.map((vmi) => vmi.metadata?.uid)), force),
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

    // The API indexes the printer columns of a CRD by position (`metadata.fields.N`), so look the position up by name
    printerColumnField(type, columnName) {
      const schema = this.$store.getters[`${ this.inStore }/schemaFor`](type);
      const column = schema?.attributes?.columns?.find((col) => col.name === columnName);

      return column?.field?.replace('$.', '').replace('[', '.').replace(']', '');
    }
  },

  // With pagination the store never holds every VM, so the masthead's loading count would never finish
  $loadingResources(route, store) {
    return canPaginate(store) ? { loadResources: [] } : {};
  },
};
</script>

<template>
  <div>
    <IconMessage
      v-if="namespaceFilterInvalid"
      :vertical="true"
      :subtle="false"
      icon="icon-filter_alt"
    >
      <template #message>
        {{ t('resourceList.nsFilteringGeneric') }}
      </template>
    </IconMessage>
    <PaginatedResourceTable
      v-else
      ref="resourceTable"
      v-bind="$attrs"
      :schema="schema"
      :headers="headers"
      :pagination-headers="paginationHeaders"
      :fetch-secondary-resources="fetchSecondaryResources"
      :fetch-page-secondary-resources="fetchPageSecondaryResources"
      :local-filter="addVMIsWithoutVM"
      default-sort-by="age"
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
    </PaginatedResourceTable>
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
