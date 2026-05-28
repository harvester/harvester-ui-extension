<script setup>
import {
  ref, computed, watch, nextTick, onBeforeUnmount
} from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import SortableTable from '@shell/components/SortableTable';
import { Banner } from '@components/Banner';
import { BadgeState } from '@components/BadgeState';
import { useI18n } from '@shell/composables/useI18n';

const props = defineProps({
  providerName: { type: String, default: '' },
  provider:     { type: Object, default: null },
  stepData:     { type: Object, required: true },
});

const emit = defineEmits(['complete', 'loading']);

const store = useStore();
const { t } = useI18n(store);

const discoveredVMs = ref([]);
const selectedVMs = ref([]);
const tableRows = ref([]);
const loading = ref(true);
const networkMap = ref({});
const datastoreMap = ref({});
const sortableTableRef = ref(null);
const allVMsSelected = ref(false);
const selectedVMIds = ref(new Set());
const errors = ref([]);
let skipNextSelectionEvent = false;

const lastFetchedAt = ref(null);
const now = ref(Date.now());

const formatElapsed = (ms) => {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${ hours } ${ hours === 1 ? 'hour' : 'hours' } and ${ minutes } ${ minutes === 1 ? 'minute' : 'minutes' }`;
  }

  if (hours > 0) {
    return `${ hours } ${ hours === 1 ? 'hour' : 'hours' }`;
  }

  return `${ Math.max(1, minutes) } ${ minutes <= 1 ? 'minute' : 'minutes' }`;
};

const lastSyncedTime = computed(() => {
  if (!lastFetchedAt.value) {
    return '';
  }

  return formatElapsed(now.value - lastFetchedAt.value);
});

const nowTimer = setInterval(() => {
  now.value = Date.now();
}, 30000);

onBeforeUnmount(() => {
  clearInterval(nowTimer);
});

// Restore from stepData
if (props.stepData.discoveredVMs.length > 0) {
  discoveredVMs.value = props.stepData.discoveredVMs;
}
if (props.stepData.selectedVMIds.size > 0) {
  selectedVMIds.value = props.stepData.selectedVMIds;
  selectedVMs.value = discoveredVMs.value.filter((vm) => selectedVMIds.value.has(vm.id));
  allVMsSelected.value = selectedVMIds.value.size === discoveredVMs.value.length;
}
if (props.stepData.tableRows.length > 0) {
  tableRows.value = props.stepData.tableRows;
}

// Sync back to stepData
watch(discoveredVMs, (val) => {
  props.stepData.discoveredVMs = val;
});
watch(selectedVMIds, (val) => {
  props.stepData.selectedVMIds = val;
});
watch(tableRows, (val) => {
  props.stepData.tableRows = val;
});

const vmCount = computed(() => discoveredVMs.value.length);
const selectedCount = computed(() => selectedVMs.value.length);

const showSelectAllBanner = computed(() => {
  if (allVMsSelected.value) {
    return true;
  }

  const pagedRows = sortableTableRef.value?.pagedRows || [];

  if (pagedRows.length === 0) {
    return false;
  }

  const allPageSelected = pagedRows.every((row) => selectedVMIds.value.has(row._original?.id));

  return allPageSelected && tableRows.value.length > pagedRows.length;
});

const theadElement = computed(() => sortableTableRef.value?.$el?.querySelector('thead'));

const headers = [
  {
    name:     'vmName',
    labelKey: 'harvester.addons.vmMigration.selectVms.columns.vmName',
    value:    'vmName',
    sort:     ['vmName'],
    subLabel: t('harvester.addons.vmMigration.generic.identifier'),
  },
  {
    name:     'os',
    labelKey: 'harvester.addons.vmMigration.selectVms.columns.os',
    value:    'os',
    sort:     ['os'],
  },
  {
    name:     'resources',
    labelKey: 'harvester.addons.vmMigration.selectVms.columns.resources',
    value:    'resources',
    sort:     false,
  },
  {
    name:     'powerState',
    labelKey: 'harvester.addons.vmMigration.selectVms.columns.powerState',
    value:    'powerState',
    sort:     ['powerState'],
  },
  {
    name:     'network',
    labelKey: 'harvester.addons.vmMigration.selectVms.columns.network',
    value:    'network',
    sort:     ['network'],
    subLabel: t('harvester.addons.vmMigration.generic.identifier'),
  },
  {
    name:     'datastore',
    labelKey: 'harvester.addons.vmMigration.selectVms.columns.datastore',
    value:    'datastore',
    sort:     ['datastore'],
    subLabel: t('harvester.addons.vmMigration.generic.identifier'),
  },
];

const buildTableRows = () => {
  return discoveredVMs.value.map((vm) => {
    const cpus = vm.cpuCount || vm.numCPU || '-';
    const memMB = vm.memoryMB || vm.memory || 0;
    const memGB = memMB ? `${ Math.round(memMB / 1024) } GB` : '-';

    let totalDiskBytes = 0;

    if (vm.disks && vm.disks.length > 0) {
      totalDiskBytes = vm.disks.reduce((sum, d) => sum + (d.capacity || 0), 0);
    }

    const diskDisplay = totalDiskBytes ? `${ Math.round(totalDiskBytes / (1024 * 1024 * 1024)) } GB` : '-';
    const rawPowerState = vm.powerState || vm.status?.phase || '-';
    const powerState = rawPowerState.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

    let networks = [];

    if (vm.networks && vm.networks.length > 0) {
      networks = vm.networks.map((n) => ({
        name:   n.name || networkMap.value[n.id] || n.id || n,
        id:     n.id || '',
        vlanId: n.vlanId || '',
      }));
    }

    const datastores = [];

    if (vm.disks && vm.disks.length > 0) {
      const seen = new Set();

      vm.disks.forEach((d) => {
        const dsId = d.datastore?.id || d.datastore?.name;

        if (dsId && !seen.has(dsId)) {
          seen.add(dsId);
          datastores.push({
            name:     d.datastore?.name || datastoreMap.value[dsId] || dsId,
            id:       d.datastore?.id || '',
            type:     d.datastore?.type || '',
            capacity: d.capacity || 0,
          });
        }
      });
    }

    return {
      _original:        vm,
      _key:             vm.id || vm.vmId || vm.metadata?.name,
      vmName:           vm.name || vm.metadata?.name || '-',
      vmId:             vm.id || vm.vmId || vm.metadata?.name || '-',
      os:               vm.guestName || vm.guestOS || vm.os || '-',
      resourcesDisplay: `${ cpus } vCPU`,
      resourcesSub:     `${ memGB } • ${ diskDisplay }`,
      powerState,
      powerStateClass:  powerState.toLowerCase().includes('on') || powerState.toLowerCase().includes('running') ? 'power-on' : 'power-off',
      networks,
      network:          networks.map((n) => n.name).join(', ') || '-',
      datastores,
      datastore:        datastores.map((d) => d.name).join(', ') || '-',
    };
  });
};

const onSelect = (rows) => {
  if (skipNextSelectionEvent) {
    return;
  }

  const currentPageRows = sortableTableRef.value?.pagedRows || [];
  const selectedKeys = new Set(rows.map((r) => r._key));

  currentPageRows.forEach((row) => {
    const vmId = row._original?.id;

    if (selectedKeys.has(row._key)) {
      selectedVMIds.value.add(vmId);
    } else {
      selectedVMIds.value.delete(vmId);
    }
  });

  allVMsSelected.value = selectedVMIds.value.size === discoveredVMs.value.length;
  selectedVMs.value = discoveredVMs.value.filter((vm) => selectedVMIds.value.has(vm.id));

  emit('complete', { selectedVMs: selectedVMs.value });
};

const clearSelection = () => {
  allVMsSelected.value = false;
  selectedVMIds.value = new Set();
  selectedVMs.value = [];

  nextTick(() => {
    const table = sortableTableRef.value;

    if (table) {
      table.clearSelection();
    }
  });
};

const selectAllVMs = () => {
  allVMsSelected.value = true;
  selectedVMIds.value = new Set(discoveredVMs.value.map((vm) => vm.id));
  selectedVMs.value = discoveredVMs.value.slice();
};

watch(
  () => sortableTableRef.value?.page,
  () => {
    skipNextSelectionEvent = true;

    nextTick(() => {
      const table = sortableTableRef.value;

      if (!table) {
        return;
      }

      const rowsToReselect = (table.pagedRows || []).filter((row) => selectedVMIds.value.has(row._original?.id));

      if (rowsToReselect.length > 0) {
        table.update(rowsToReselect, []);
      }

      skipNextSelectionEvent = false;
    });
  }
);

const refreshing = ref(false);

const isLoading = computed(() => loading.value || refreshing.value);

watch(isLoading, (val) => {
  emit('loading', val);
}, { immediate: true });

const fetchVMs = async() => {
  if (!props.provider) {
    return;
  }

  const providerUid = props.provider.metadata.uid;
  const providerType = props.provider.spec?.type || 'vsphere';
  const baseUrl = `https://forklift-apir.13.48.147.135.sslip.io/providers/${ providerType }/${ providerUid }`;

  const [vmsResp, networksResp, datastoresResp] = await Promise.all([
    fetch(`${ baseUrl }/vms`).then((r) => r.json()),
    fetch(`${ baseUrl }/networks`).then((r) => r.json()).catch(() => []),
    fetch(`${ baseUrl }/datastores`).then((r) => r.json()).catch(() => []),
  ]);

  if (Array.isArray(vmsResp)) {
    discoveredVMs.value = vmsResp;
  } else if (vmsResp?.data && Array.isArray(vmsResp.data)) {
    discoveredVMs.value = vmsResp.data;
  }

  const networks = Array.isArray(networksResp) ? networksResp : (networksResp?.data || []);
  const datastores = Array.isArray(datastoresResp) ? datastoresResp : (datastoresResp?.data || []);

  networkMap.value = networks.reduce((map, n) => {
    map[n.id] = n.name;

    return map;
  }, {});
  datastoreMap.value = datastores.reduce((map, d) => {
    map[d.id] = d.name;

    return map;
  }, {});

  lastFetchedAt.value = Date.now();
  tableRows.value = buildTableRows();
};

const refreshVMs = async() => {
  refreshing.value = true;
  skipNextSelectionEvent = true;

  const previousSelectedIds = new Set(selectedVMIds.value);

  try {
    errors.value = [];
    await fetchVMs();
  } catch (e) {
    discoveredVMs.value = [];
    tableRows.value = [];
    errors.value = [e?.message || t('harvester.addons.vmMigration.errors.failedRefreshVms')];
  }

  selectedVMIds.value = new Set(
    discoveredVMs.value
      .filter((vm) => previousSelectedIds.has(vm.id))
      .map((vm) => vm.id)
  );
  selectedVMs.value = discoveredVMs.value.filter((vm) => selectedVMIds.value.has(vm.id));
  allVMsSelected.value = selectedVMIds.value.size > 0 && selectedVMIds.value.size === discoveredVMs.value.length;

  props.stepData.discoveredVMs = discoveredVMs.value;
  props.stepData.selectedVMIds = selectedVMIds.value;
  props.stepData.tableRows = tableRows.value;
  emit('complete', { selectedVMs: selectedVMs.value });
  refreshing.value = false;

  await nextTick();

  const table = sortableTableRef.value;

  if (table) {
    const rowsToReselect = (table.pagedRows || []).filter((row) => selectedVMIds.value.has(row._original?.id));

    if (rowsToReselect.length > 0) {
      table.update(rowsToReselect, []);
    }
  }

  skipNextSelectionEvent = false;
};

const init = async() => {
  if (discoveredVMs.value.length > 0) {
    if (!lastFetchedAt.value) {
      lastFetchedAt.value = Date.now();
    }
    tableRows.value = buildTableRows();
    loading.value = false;

    return;
  }

  try {
    await fetchVMs();
  } catch (e) {
    discoveredVMs.value = [];
    errors.value = [e?.message || t('harvester.addons.vmMigration.errors.failedLoadVms')];
  }

  loading.value = false;
};

// Emit initial complete if VMs are already selected (restored from stepData)
if (selectedVMs.value.length > 0) {
  emit('complete', { selectedVMs: selectedVMs.value });
}

init();
</script>

<template>
  <Loading v-if="refreshing" />
  <Loading v-if="loading" />
  <div
    v-else
    class="select-vms-step"
  >
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
    />
    <p class="text-deemphasized line-height-20">
      {{ t('harvester.addons.vmMigration.selectVms.discovered', { count: vmCount }) }}
      <router-link
        v-if="provider"
        class="provider-link"
        :to="provider._detailLocation"
      >
        {{ providerName }}
      </router-link>
      <br>
      <span
        v-if="lastSyncedTime"
      >
        {{ t('harvester.addons.vmMigration.selectVms.lastSynced', { time: lastSyncedTime }) }}
        <a
          role="button"
          class="text-bold"
          :class="{ disabled: refreshing }"
          @click.prevent="refreshVMs"
        >
          {{ t('harvester.addons.vmMigration.selectVms.refreshNow') }}
        </a>
      </span>
    </p>
    <!-- Discovered VMs table -->
    <SortableTable
      ref="sortableTableRef"
      :rows="tableRows"
      :headers="headers"
      :search="true"
      :table-actions="true"
      :row-actions="false"
      :groupable="false"
      :paging="true"
      :rows-per-page="20"
      key-field="_key"
      @selection="onSelect"
    >
      <template #header-left>
        <div class="vm-table-title">
          <h3 class="m-0">
            {{ t('harvester.addons.vmMigration.selectVms.availableVms') }}
          </h3>
          <span class="text-deemphasized">{{ selectedCount }} {{ t('harvester.addons.vmMigration.selectVms.selected') }}</span>
        </div>
      </template>
      <template #cell:vmName="{ row }">
        <div class="vm-name-cell">
          <span class="vm-name">{{ row.vmName }}</span>
          <span class="vm-id text-deemphasized">{{ row.vmId }}</span>
        </div>
      </template>
      <template #cell:resources="{ row }">
        <span>{{ row.resourcesDisplay }}</span><br>
        <span class="text-deemphasized">{{ row.resourcesSub }}</span>
      </template>
      <template #cell:powerState="{ row }">
        <BadgeState
          :label="row.powerState"
          :color="row.powerStateClass === 'power-on' ? 'bg-warning' : 'bg-darker'"
        />
      </template>
      <template #cell:network="{ row }">
        <div>
          <div
            v-for="(net, i) in row.networks"
            :key="i"
            :class="{ 'mt-4': i > 0 }"
          >
            <span>{{ net.name }}</span><br>
            <span class="text-deemphasized">{{ net.id }}</span>
          </div>
        </div>
      </template>
      <template #cell:datastore="{ row }">
        <div>
          <div
            v-for="(ds, i) in row.datastores"
            :key="i"
            :class="{ 'mt-4': i > 0 }"
          >
            <span>{{ ds.name }}</span><br>
            <span class="text-deemphasized">{{ ds.id }}</span>
          </div>
        </div>
      </template>
    </SortableTable>

    <Teleport
      v-if="showSelectAllBanner && theadElement"
      :to="theadElement"
    >
      <tr class="select-all-banner-row">
        <td
          :colspan="headers.length + 1"
          class="select-all-banner-cell"
        >
          <template v-if="allVMsSelected">
            <span>{{ t('harvester.addons.vmMigration.selectVms.selectAllBanner.allSelected') }}</span>
            <a
              role="button"
              @click.prevent="clearSelection"
            >
              {{ t('harvester.addons.vmMigration.selectVms.selectAllBanner.clearSelection') }}
            </a>
          </template>
          <template v-else>
            <span>{{ t('harvester.addons.vmMigration.selectVms.selectAllBanner.pageOnly') }}</span>
            <a
              role="button"
              @click.prevent="selectAllVMs"
            >
              {{ t('harvester.addons.vmMigration.selectVms.selectAllBanner.selectAll', { count: vmCount }) }}
            </a>
          </template>
        </td>
      </tr>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
  .vm-table-title {
    h4 {
      margin: 0;
      font-weight: 600;
    }

    .text-deemphasized {
      font-size: 13px;
    }
  }

  .vm-name-cell {
    display: flex;
    flex-direction: column;
    font-size: 14px;

    .vm-name {
      line-height: 20px;
    }

    .vm-id {
      line-height: 20px;
    }
  }

  .select-vms-step {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;

    .line-height-20 {
      line-height: 20px;
    }
  }

  :deep(.select-all-banner-row) {
    .select-all-banner-cell {
      text-align: center;
      padding: 8px 16px;
      background-color: var(--sortable-table-header-bg);
      border-bottom: 1px solid var(--border);
      font-size: 13px;

      a {
        color: var(--primary);
        cursor: pointer;
        font-weight: 600;
        margin-left: 5px;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
</style>
