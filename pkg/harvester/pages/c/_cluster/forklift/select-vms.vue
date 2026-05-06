<script>
import { defineComponent, ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import SortableTable from '@shell/components/SortableTable';
import { LabeledInput } from '@components/Form/LabeledInput';
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

export default defineComponent({
  name: 'ForkliftSelectVms',

  components: {
    Loading,
    Masthead,
    SortableTable,
    LabeledInput,
  },

  setup() {
    const store = useStore();
    const route = useRoute();
    const router = useRouter();
    const { t } = useI18n(store);

    const allProviders = ref([]);
    const provider = ref(null);
    const discoveredVMs = ref([]);
    const selectedVMs = ref([]);
    const manualVMs = ref([]);
    const newVmId = ref('');
    const tableRows = ref([]);
    const loading = ref(true);

    const providerName = computed(() => provider.value?.metadata?.name || route.query.provider || '');
    const vmCount = computed(() => discoveredVMs.value.length);
    const showManualEntry = computed(() => discoveredVMs.value.length === 0);
    const selectedCount = computed(() => showManualEntry.value ? manualVMs.value.length : selectedVMs.value.length);

    const manualHeaders = [
      {
        name:     'id',
        labelKey: 'harvester.addons.forklift.selectVms.columns.vmId',
        value:    'id',
      },
    ];

    const headers = [
      {
        name:     'vmName',
        labelKey: 'harvester.addons.forklift.selectVms.columns.vmName',
        value:    'vmName',
        subLabel: 'Identifier',
      },
      {
        name:     'os',
        labelKey: 'harvester.addons.forklift.selectVms.columns.os',
        value:    'os',
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
      },
      {
        name:     'network',
        labelKey: 'harvester.addons.forklift.selectVms.columns.network',
        value:    'network',
        subLabel: 'Identifier',
      },
      {
        name:     'datastore',
        labelKey: 'harvester.addons.forklift.selectVms.columns.datastore',
        value:    'datastore',
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
        const powerState = vm.powerState || vm.status?.phase || '-';

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

    const addManualVm = () => {
      if (!newVmId.value) {
        return;
      }

      manualVMs.value.push({
        id:   newVmId.value.trim(),
        name: newVmId.value.trim(),
        _key: `manual-${ newVmId.value.trim() }`,
      });

      newVmId.value = '';
    };

    const removeManualVm = (index) => {
      manualVMs.value.splice(index, 1);
    };

    const onSelect = (rows) => {
      selectedVMs.value = rows.map((r) => r._original);
    };

    const cancel = () => {
      router.push({
        name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
        params: {
          product: route.params.product,
          cluster: route.params.cluster,
        }
      });
    };

    const saveSelection = () => {
      let vmIds;

      if (showManualEntry.value) {
        vmIds = manualVMs.value.map((vm) => vm.id);
      } else {
        vmIds = selectedVMs.value.map((vm) => vm.id || vm.vmId || vm.metadata?.name);
      }

      router.push({
        name:   `${ PRODUCT_NAME }-c-cluster-forklift-configure-mappings`,
        params: {
          product: route.params.product,
          cluster: route.params.cluster,
        },
        query: {
          provider:  providerName.value,
          namespace: provider.value?.metadata?.namespace || 'default',
          vms:       JSON.stringify(vmIds),
        }
      });
    };

    const init = async() => {
      const inStore = store.getters['currentProduct'].inStore;

      allProviders.value = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });

      const queryProvider = route.query.provider;
      const namespace = route.query.namespace || 'default';

      if (queryProvider) {
        provider.value = allProviders.value.find(
          (p) => p.metadata.name === queryProvider && p.metadata.namespace === namespace
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

    return {
      schema,
      loading,
      provider,
      providerName,
      discoveredVMs,
      selectedVMs,
      manualVMs,
      newVmId,
      tableRows,
      vmCount,
      showManualEntry,
      selectedCount,
      manualHeaders,
      headers,
      t,
      addManualVm,
      removeManualVm,
      onSelect,
      cancel,
      saveSelection,
    };
  },
});
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

    <!-- Manual VM entry when no discovered VMs -->
    <div v-if="showManualEntry">
      <h3 class="m-0 mb-10">
        {{ t('harvester.addons.forklift.selectVms.manualEntry.title') }}
      </h3>
      <p class="text-muted mb-20">
        {{ t('harvester.addons.forklift.selectVms.manualEntry.description') }}
      </p>

      <div class="manual-vm-form">
        <div class="row">
          <div class="col span-6">
            <LabeledInput
              v-model:value="newVmId"
              :label="t('harvester.addons.forklift.selectVms.manualEntry.vmId')"
              :placeholder="t('harvester.addons.forklift.selectVms.manualEntry.vmIdPlaceholder')"
            />
          </div>
          <div class="col span-2 add-btn-col">
            <button
              class="btn role-primary"
              :disabled="!newVmId"
              @click="addManualVm"
            >
              {{ t('harvester.addons.forklift.selectVms.manualEntry.add') }}
            </button>
          </div>
        </div>
      </div>

      <SortableTable
        :rows="manualVMs"
        :headers="manualHeaders"
        :search="false"
        :table-actions="false"
        :row-actions="false"
        :groupable="false"
        key-field="_key"
        class="mt-20"
      >
        <template #header-left>
          <span class="text-muted">{{ manualVMs.length }} {{ t('harvester.addons.forklift.selectVms.manualEntry.added') }}</span>
        </template>
        <template #cell:id="{ row }">
          <div class="manual-vm-row">
            <span>{{ row.id }}</span>
            <button
              class="btn btn-sm role-link"
              @click="removeManualVm(manualVMs.indexOf(row))"
            >
              <i class="icon icon-close" />
            </button>
          </div>
        </template>
      </SortableTable>
    </div>

    <!-- Discovered VMs table -->
    <SortableTable
      v-else
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
        <span
          class="power-badge"
          :class="row.powerStateClass"
        >{{ row.powerState }}</span>
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

    .vm-name {
      font-weight: 600;
      line-height: 20px;
    }

    .vm-id {
      font-size: 12px;
      line-height: 20px;
    }
  }

  .power-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;

    &.power-on {
      background-color: #d4edda;
      color: #155724;
    }

    &.power-off {
      background-color: #fff3cd;
      color: #856404;
    }
  }

  .manual-vm-form {
    .add-btn-col {
      display: flex;
      align-items: flex-end;
    }
  }

  .manual-vm-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .multi-line-cell {
    display: flex;
    flex-direction: column;
    line-height: 20px;
  }

  .mt-4 {
    margin-top: 4px;
  }

  .actions-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 30px;
  }
</style>
