<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { SCHEMA } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import vmData from '../../../../utils/vms.json';

const schema = {
  id:         HCI.FORKLIFT_PROVIDER,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_PROVIDER,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_PROVIDER },
};

const store = useStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n(store);

const allProviders = ref([]);
const provider = ref(null);
const discoveredVMs = ref([]);
const selectedVMs = ref([]);
const tableRows = ref([]);
const loading = ref(true);

const providerName = computed(() => provider.value?.metadata?.name || route.query.provider || '');
const vmCount = computed(() => discoveredVMs.value.length);
const selectedCount = computed(() => selectedVMs.value.length);

const headers = [
  {
    name:     'vmName',
    labelKey: 'harvester.addons.forklift.selectVms.columns.vmName',
    value:    'vmName',
    sort:     ['vmName'],
    subLabel: 'Identifier',
  },
  {
    name:     'os',
    labelKey: 'harvester.addons.forklift.selectVms.columns.os',
    value:    'os',
    sort:     ['os'],
  },
  {
    name:     'resources',
    labelKey: 'harvester.addons.forklift.selectVms.columns.resources',
    value:    'resources',
    sort:     false,
  },
  {
    name:     'powerState',
    labelKey: 'harvester.addons.forklift.selectVms.columns.powerState',
    value:    'powerState',
    sort:     ['powerState'],
  },
  {
    name:     'network',
    labelKey: 'harvester.addons.forklift.selectVms.columns.network',
    value:    'network',
    sort:     ['network'],
    subLabel: 'Identifier',
  },
  {
    name:     'datastore',
    labelKey: 'harvester.addons.forklift.selectVms.columns.datastore',
    value:    'datastore',
    sort:     ['datastore'],
    subLabel: 'Identifier',
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
        name:   n.name || n.id || n,
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
            name:     d.datastore?.name || dsId,
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
  selectedVMs.value = rows.map((r) => r._original);
};

const cancel = async() => {
  const inStore = store.getters['currentProduct'].inStore;
  const providers = store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [];
  const found = providers.find((p) => p.metadata.name === providerName.value && p.metadata.namespace === 'forklift');

  if (found) {
    await found.remove();
  }

  router.push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
    params: {
      product: route.params.product,
      cluster: route.params.cluster,
    }
  });
};

const saveSelection = () => {
  const vmIds = selectedVMs.value.map((vm) => vm.id || vm.vmId || vm.metadata?.name);

  router.push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift-configure-mappings`,
    params: {
      product: route.params.product,
      cluster: route.params.cluster,
    },
    query: {
      provider: providerName.value,
      vms:      JSON.stringify(vmIds),
    }
  });
};

const init = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  allProviders.value = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });

  const queryProvider = route.query.provider;

  if (queryProvider) {
    provider.value = allProviders.value.find(
      (p) => p.metadata.name === queryProvider && p.metadata.namespace === 'forklift'
    );
  }

  if (provider.value) {
    try {
      const inventoryType = 'forklift-inventory.konveyor.io.vspherevm';

      discoveredVMs.value = await store.dispatch(`${ inStore }/findAll`, { type: inventoryType });
    } catch (e) {
      discoveredVMs.value = [];
    }
  }

  if (discoveredVMs.value.length === 0) {
    discoveredVMs.value = vmData;
  }

  tableRows.value = buildTableRows();
  loading.value = false;
};

init();
</script>

<template>
  <Loading v-if="loading" />
  <div
    v-else
  >
    <Masthead
      :schema="schema"
      :resource="schema.id"
      :type-display="t('harvester.addons.forklift.selectVms.title')"
      :is-creatable="false"
    >
      <template #subHeader>
        <p class="text-muted mmt-5">
          {{ t('harvester.addons.forklift.selectVms.discovered', { count: vmCount }) }}
          <a
            v-if="providerName"
            class="provider-link"
          >{{ providerName }}</a>
          <br>
          <span class="text-small">{{ t('harvester.addons.forklift.selectVms.lastSynced') }}</span>
        </p>
      </template>
    </Masthead>

    <!-- Discovered VMs table -->
    <SortableTable
      :rows="tableRows"
      :headers="headers"
      :search="true"
      :table-actions="true"
      :row-actions="false"
      :groupable="false"
      key-field="_key"
      @selection="onSelect"
    >
      <template #header-left>
        <div class="vm-table-title">
          <h3 class="m-0">
            {{ t('harvester.addons.forklift.selectVms.availableVms') }}
          </h3>
          <span class="text-muted">{{ selectedCount }} {{ t('harvester.addons.forklift.selectVms.selected') }}</span>
        </div>
      </template>
      <template #cell:vmName="{ row }">
        <div class="vm-name-cell">
          <span class="vm-name">{{ row.vmName }}</span>
          <span class="vm-id text-muted">{{ row.vmId }}</span>
        </div>
      </template>
      <template #cell:resources="{ row }">
        <span>{{ row.resourcesDisplay }}</span><br>
        <span class="text-muted">{{ row.resourcesSub }}</span>
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
            <span class="text-muted">{{ net.id }}</span>
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
            <span class="text-muted">{{ ds.id }}</span>
          </div>
        </div>
      </template>
    </SortableTable>

    <div class="actions-footer">
      <button
        class="btn role-secondary"
        @click="cancel"
      >
        {{ t('generic.cancel') }}
      </button>
      <button
        class="btn role-primary"
        :disabled="selectedCount === 0"
        @click="saveSelection"
      >
        {{ t('harvester.addons.forklift.selectVms.saveSelection') }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .provider-link {
    color: var(--primary);
    font-weight: 600;
  }

  .vm-table-title {
    h4 {
      margin: 0;
      font-weight: 600;
    }

    .text-muted {
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

  .actions-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 30px;
  }
</style>
