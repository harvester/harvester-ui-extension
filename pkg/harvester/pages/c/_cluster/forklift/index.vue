<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import ResourceTable from '@shell/components/ResourceTable';
import PercentageBar from '@shell/components/PercentageBar';
import MappingsCell from '../../../../components/MappingsCell';
import { SCHEMA } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { FORKLIFT_PLAN_VM_COUNT } from '../../../../config/table-headers';
import { STATE, NAME as NAME_COL, AGE } from '@shell/config/table-headers';

const schema = {
  id:         HCI.FORKLIFT_PLAN,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_PLAN,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_PLAN },
};

const store = useStore();
const route = useRoute();
const { t } = useI18n(store);

const loading = ref(true);

const inStore = computed(() => store.getters['currentProduct'].inStore);

const allPlans = computed(() => store.getters[`${ inStore.value }/all`](HCI.FORKLIFT_PLAN));
const allNetworkMaps = computed(() => store.getters[`${ inStore.value }/all`](HCI.FORKLIFT_NETWORK_MAP));
const allStorageMaps = computed(() => store.getters[`${ inStore.value }/all`](HCI.FORKLIFT_STORAGE_MAP));

const rows = computed(() => {
  return allPlans.value.map((plan) => {
    const netMapName = plan.spec?.map?.network?.name;
    const netMapNs = plan.spec?.map?.network?.namespace || plan.metadata.namespace;
    const storMapName = plan.spec?.map?.storage?.name;
    const storMapNs = plan.spec?.map?.storage?.namespace || plan.metadata.namespace;

    const netMap = allNetworkMaps.value.find((m) => m.metadata.name === netMapName && m.metadata.namespace === netMapNs);
    const storMap = allStorageMaps.value.find((m) => m.metadata.name === storMapName && m.metadata.namespace === storMapNs);

    plan.networkEntries = (netMap?.spec?.map || []).map((e) => `${ e.source?.id || '-' } → ${ e.destination?.type === 'pod' ? 'Pod Network' : (e.destination?.name || '-') }`);
    plan.storageEntries = (storMap?.spec?.map || []).map((e) => `${ e.source?.id || '-' } → ${ e.destination?.storageClass || '-' }`);
    plan.networkDisplay = plan.networkEntries.join(', ') || '-';
    plan.storageDisplay = plan.storageEntries.join(', ') || '-';

    plan.vmIdsDisplay = (plan.spec?.vms || []).map((vm) => vm.id || vm.name || '').filter(Boolean).join(', ') || '-';

    const vms = plan.status?.migration?.vms || [];

    plan.vmProgress = vms.map((vm) => {
      const pipeline = vm.pipeline || [];
      const totalSteps = pipeline.length || 1;
      let overallProgress = 0;
      let currentStep = '';
      let errorMsg = '';

      pipeline.forEach((step, idx) => {
        const stepWeight = 100 / totalSteps;

        if (step.phase === 'Completed') {
          overallProgress += stepWeight;
        } else {
          const stepPct = (step.progress?.completed && step.progress?.total) ? (step.progress.completed / step.progress.total) * 100 : 0;

          overallProgress += (stepPct / 100) * stepWeight;

          if (!currentStep) {
            currentStep = step.name || `Step ${ idx + 1 }`;
          }

          if (step.error) {
            errorMsg = (step.error.reasons || []).join('; ') || 'Error';
          }
        }
      });

      overallProgress = Math.round(overallProgress);

      return {
        vmName:   vm.name || vm.id || 'Unknown',
        vmId:     vm.id || '',
        progress: overallProgress,
        currentStep,
        errorMsg,
      };
    });

    plan.progress = plan.vmProgress.length > 0 ? Math.round(plan.vmProgress.reduce((sum, vm) => sum + vm.progress, 0) / plan.vmProgress.length) : 0;

    return plan;
  });
});

const createLocation = computed(() => ({
  name:   `${ PRODUCT_NAME }-c-cluster-forklift-configure-provider`,
  params: {
    product: route.params.product,
    cluster: route.params.cluster,
  }
}));

const headers = [
  { ...STATE, labelKey: 'harvester.addons.forklift.dashboard.columns.status' },
  {
    ...NAME_COL,
    labelKey: 'harvester.addons.forklift.dashboard.columns.plan',
    subLabel: 'VM IDs',
  },
  { ...FORKLIFT_PLAN_VM_COUNT, width: 105 },
  {
    name:     'progress',
    labelKey: 'harvester.addons.forklift.dashboard.columns.progress',
    value:    'progress',
    width:    500,
  },
  {
    name:     'mappings',
    labelKey: 'harvester.addons.forklift.dashboard.columns.mappings',
    value:    'mappingsDisplay',
  },
  { ...AGE },
];

const init = async() => {
  await Promise.all([
    store.dispatch(`${ inStore.value }/findAll`, { type: HCI.FORKLIFT_PLAN }),
    store.dispatch(`${ inStore.value }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP }),
    store.dispatch(`${ inStore.value }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP }),
  ]);

  loading.value = false;
};

init();
</script>

<template>
  <Loading v-if="loading" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="schema.id"
      :type-display="t('harvester.addons.forklift.dashboard.title')"
    >
      <template #subHeader>
        <div class="mmt-5">
          <p class="text-muted">
            {{ t('harvester.addons.forklift.dashboard.description') }}
          </p>
        </div>
      </template>
      <template #createButton>
        <router-link
          :to="createLocation"
          class="btn role-primary"
        >
          {{ t('harvester.addons.forklift.dashboard.createPlan') }}
        </router-link>
      </template>
    </Masthead>

    <ResourceTable
      :schema="schema"
      :rows="rows"
      :headers="headers"
      :groupable="false"
      :table-actions="false"
      :search="false"
      key-field="_key"
    >
      <template #header-left>
        <h3 class="table-title m-0">
          {{ t('harvester.addons.forklift.dashboard.tableTitle') }}
        </h3>
      </template>
      <template #cell:name="{ row }">
        <div class="plan-name-cell">
          <div class="plan-name">
            {{ row.metadata.name }}
          </div>
          <div class="plan-vms text-muted">
            {{ row.vmIdsDisplay }}
          </div>
        </div>
      </template>
      <template #cell:vmCount="{ row }">
        {{ (row.spec.vms || []).length }} VMs
      </template>
      <template #cell:progress="{ row }">
        <div
          v-if="row.vmProgress && row.vmProgress.length"
          class="progress-cells"
        >
          <div
            v-for="vm in row.vmProgress"
            :key="vm.vmId"
            class="vm-progress"
          >
            <div class="vm-progress-header">
              <div class="vm-name-block">
                <span class="vm-name">{{ vm.vmName }}</span>
                <span class="text-muted vm-id">id: {{ vm.vmId }}</span>
              </div>
              <span class="vm-pct">{{ vm.progress }}%</span>
            </div>
            <PercentageBar
              :model-value="vm.progress"
              :color-stops="vm.errorMsg ? { 0: '--error' } : { 99: '--primary', 100: '--success' }"
              preferred-direction="MORE"
              class="vm-bar"
            />
            <div
              v-if="vm.progress === 100"
              class="step-label text-muted"
            >
              Finished Successfully
            </div>
            <div
              v-else-if="vm.errorMsg"
              class="step-label text-error"
            >
              {{ vm.errorMsg }}
            </div>
            <div
              v-else-if="vm.currentStep"
              class="step-label text-muted"
            >
              {{ vm.currentStep }}
            </div>
          </div>
        </div>
        <span v-else>-</span>
      </template>
      <template #cell:mappings="{ row }">
        <MappingsCell
          :network-entries="row.networkEntries"
          :storage-entries="row.storageEntries"
        />
      </template>
    </ResourceTable>
  </div>
</template>

<style lang="scss" scoped>
  .plan-name-cell {
    .plan-name {
      font-weight: 600;
      line-height: 20px;
    }

    .plan-vms {
      font-size: 12px;
      line-height: 20px;
      color: var(--muted);
    }
  }

  .progress-cells {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .vm-progress {
    &:not(:last-child) {
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
  }

  .vm-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .vm-name {
    font-weight: 600;
    font-size: 12px;
  }

  .vm-name-block {
    display: flex;
    flex-direction: row;
    gap: 8px;
  }

  .vm-id {
    font-size: 11px;
  }

  .vm-pct {
    font-size: 12px;
    font-weight: 600;
  }

  .vm-bar {
    width: 100%;
  }

  .step-label {
    font-size: 12px;
    margin-top: 4px;
    line-height: 20px;

    &.text-error {
      color: var(--error);
      font-weight: 600;
    }
  }

  .table-title {
    font-weight: 600;
  }
</style>
