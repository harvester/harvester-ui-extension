<script>
import { defineComponent, ref, computed } from 'vue';
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

export default defineComponent({
  name: 'ForkliftMigrationDashboard',

  components: {
    Loading,
    Masthead,
    MappingsCell,
    PercentageBar,
    ResourceTable,
  },

  setup() {
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
          const totalSteps = pipeline.length;
          const completedSteps = pipeline.filter((s) => s.phase === 'Completed').length;

          return {
            name:     vm.id || vm.name || 'Unknown',
            steps:    pipeline.map((step) => ({
              name:     step.name || 'Unknown',
              progress: step.phase === 'Completed' ? 100 : (step.progress?.completed && step.progress?.total ? Math.round((step.progress.completed / step.progress.total) * 100) : 0),
              hasError: !!step.error,
              reason:   (step.error?.reasons || []).join('; ') || '',
            })),
            progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
          };
        });

        let totalSteps = 0;
        let completedSteps = 0;

        vms.forEach((vm) => {
          const pipeline = vm.pipeline || [];

          totalSteps += pipeline.length;
          completedSteps += pipeline.filter((s) => s.phase === 'Completed').length;
        });

        plan.progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

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
        width:    299,
      },
      {
        name:     'mappings',
        labelKey: 'harvester.addons.forklift.dashboard.columns.mappings',
        value:    'mappingsDisplay',
        width:    387,
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

    return {
      schema,
      loading,
      rows,
      createLocation,
      headers,
      t,
    };
  },
});
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
          class="progress-steps"
        >
          <div
            v-for="vm in row.vmProgress"
            :key="vm.name"
            class="vm-progress"
          >
            <div class="vm-name">
              {{ vm.name }}
            </div>
            <div
              v-for="step in vm.steps"
              :key="step.name"
              class="progress-step"
            >
              <span
                class="step-name"
                :class="{ 'text-error': step.hasError }"
              >
                {{ step.name }}
              </span>
              <PercentageBar
                :model-value="step.progress"
                :color-stops="step.hasError ? { 0: '--error' } : { 99: '--primary', 100: '--success' }"
                preferred-direction="MORE"
                class="step-bar"
              />
              <span class="step-pct">{{ step.progress }}%</span>
            </div>
            <div
              v-for="step in vm.steps.filter(s => s.hasError)"
              :key="`error-${step.name}`"
              class="step-error-msg"
            >
              <span class="text-error">{{ step.reason }}</span>
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

  .progress-steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vm-progress {
    &:not(:last-child) {
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
  }

  .vm-name {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .progress-step {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
    padding-right: 13px;
  }

  .step-error-msg {
    margin-top: 4px;
    font-size: 12px;

    .text-error {
      color: var(--error);
    }
  }

  .step-name {
    font-size: 12px;
    width: 110px;
    min-width: 110px;
    max-width: 110px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.text-error {
      color: var(--error);
      font-weight: 600;
    }
  }

  .step-bar {
    flex: 1;
    min-width: 80px;
  }

  .step-pct {
    font-size: 12px;
    min-width: 35px;
    text-align: left;
  }

  .table-title {
    font-weight: 600;
  }
</style>
