<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import ResourceTable from '@shell/components/ResourceTable';
import PercentageBar from '@shell/components/PercentageBar';
import { Banner } from '@components/Banner';
import MappingsCell from '../../../../components/MappingsCell';
import { SCHEMA } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { ADD_ONS } from '../../../../config/harvester-map';
import { currentRouter } from '../../../../utils/router';
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
const { t } = useI18n(store);

const loading = ref(true);
const errors = ref([]);

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

    plan.networkEntries = (netMap?.spec?.map || []).map((e) => `${ e.source?.id || '-' } → ${ e.destination?.type === 'pod' ? t('harvester.addons.vmMigration.generic.podNetwork') : (e.destination?.name || '-') }`);
    plan.storageEntries = (storMap?.spec?.map || []).map((e) => `${ e.source?.id || '-' } → ${ e.destination?.storageClass || '-' }`);

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
            currentStep = step.name || t('harvester.addons.vmMigration.dashboard.progress.step', { index: idx + 1 });
          }

          if (step.error && !errorMsg) {
            const reasons = (step.error.reasons || []).join('; ') || t('harvester.addons.vmMigration.plan.states.error');

            errorMsg = `${ step.name || t('harvester.addons.vmMigration.dashboard.progress.step', { index: idx + 1 }) }: ${ reasons }`;
          }

          if (step.phase === 'Failed' && !errorMsg) {
            errorMsg = `${ step.name || t('harvester.addons.vmMigration.dashboard.progress.step', { index: idx + 1 }) }: ${ t('harvester.addons.vmMigration.dashboard.progress.failed') }`;
          }
        }
      });

      // Fallback to VM-level error if no step-level error found
      if (!errorMsg && vm.error) {
        const reasons = (vm.error.reasons || []).join('; ') || t('harvester.addons.vmMigration.dashboard.progress.failed');

        errorMsg = `${ currentStep || vm.error.phase || t('harvester.addons.vmMigration.dashboard.progress.migration') }: ${ reasons }`;
      }

      overallProgress = Math.round(overallProgress * 10) / 10;

      // If no step-level error but the plan itself is failed, surface it
      if (!errorMsg && plan.planFailed) {
        errorMsg = `${ currentStep || t('harvester.addons.vmMigration.dashboard.progress.migration') }: ${ t('harvester.addons.vmMigration.dashboard.progress.failed') }`;
      }

      return {
        vmName:   vm.name || vm.id || t('harvester.addons.vmMigration.generic.unknown'),
        vmId:     vm.id || '',
        progress: overallProgress,
        currentStep,
        errorMsg,
        canceled: plan.planCanceled,
      };
    });

    // If no migration progress but we have VMs in the spec, show them at 0%
    if (plan.vmProgress.length === 0 && plan.spec?.vms?.length > 0) {
      plan.vmProgress = plan.spec.vms.map((vm) => ({
        vmName:      vm.name || vm.id || t('harvester.addons.vmMigration.generic.unknown'),
        vmId:        vm.id || '',
        progress:    0,
        currentStep: t('harvester.addons.vmMigration.dashboard.progress.initializingMigration'),
        errorMsg:    '',
        canceled:    false,
      }));
    }

    plan.progress = plan.vmProgress.length > 0 ? Math.round(plan.vmProgress.reduce((sum, vm) => sum + vm.progress, 0) / plan.vmProgress.length * 10) / 10 : 0;

    return plan;
  });
});

const createLocation = computed(() => ({
  name:   `${ PRODUCT_NAME }-c-cluster-vm-migration-wizard`,
  params: {
    product: store.getters['productId'],
    cluster: store.getters['clusterId'],
  }
}));

const headers = [
  { ...STATE, labelKey: 'harvester.addons.vmMigration.dashboard.columns.status' },
  {
    ...NAME_COL,
    labelKey: 'harvester.addons.vmMigration.dashboard.columns.plan',
  },
  { ...FORKLIFT_PLAN_VM_COUNT, width: 105 },
  {
    name:     'progress',
    labelKey: 'harvester.addons.vmMigration.dashboard.columns.progress',
    value:    'progress',
    width:    500,
  },
  {
    name:     'mappings',
    labelKey: 'harvester.addons.vmMigration.dashboard.columns.mappings',
  },
  { ...AGE },
];

const init = async() => {
  try {
    // Guard: the Forklift dashboard is only available when the Forklift addon is
    // enabled. Redirect back to the Harvester dashboard otherwise (e.g. direct URL).
    let forkliftEnabled = false;

    if (store.getters[`${ inStore.value }/schemaFor`](HCI.ADD_ONS)) {
      const addons = await store.dispatch(`${ inStore.value }/findAll`, { type: HCI.ADD_ONS });

      forkliftEnabled = addons.find((a) => a.metadata?.name === ADD_ONS.FORKLIFT_OPERATOR)?.spec?.enabled === true;
    }

    if (!forkliftEnabled) {
      await currentRouter().replace({
        name:   `${ PRODUCT_NAME }-c-cluster-resource`,
        params: {
          product:  store.getters['productId'],
          cluster:  store.getters['clusterId'],
          resource: HCI.DASHBOARD,
        },
      });

      return;
    }

    await Promise.all([
      store.dispatch(`${ inStore.value }/findAll`, { type: HCI.FORKLIFT_PLAN }),
      store.dispatch(`${ inStore.value }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP }),
      store.dispatch(`${ inStore.value }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP }),
    ]);
  } catch (e) {
    errors.value = [e?.message || t('harvester.addons.vmMigration.errors.failedLoadPlans')];
  } finally {
    loading.value = false;
  }
};

init();
</script>

<template>
  <Loading v-if="loading" />
  <div v-else>
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
    />
    <Masthead
      :schema="schema"
      :resource="schema.id"
      :type-display="t('harvester.addons.vmMigration.dashboard.title')"
    >
      <template #subHeader>
        <div class="mmt-5">
          <p
            v-clean-html="t('harvester.addons.vmMigration.dashboard.description')"
            class="text-muted"
          ></p>
        </div>
      </template>
      <template #createButton>
        <router-link
          :to="createLocation"
          class="btn role-primary"
        >
          {{ t('harvester.addons.vmMigration.dashboard.createPlan') }}
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
      <template #cell:name="{ row }">
        <div class="plan-name-cell">
          <div class="plan-name">
            {{ row.metadata.name }}
          </div>
        </div>
      </template>
      <template #cell:vmCount="{ row }">
        {{ t('harvester.addons.vmMigration.dashboard.progress.vmCount', { count: (row.spec.vms || []).length }) }}
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
                <span class="text-muted vm-id">{{ t('harvester.addons.vmMigration.dashboard.progress.vmId', { id: vm.vmId }) }}</span>
              </div>
            </div>
            <div class="vm-pct-block">
              <PercentageBar
                :model-value="vm.progress"
                :color-stops="vm.errorMsg ? { 100: '--error' } : vm.canceled ? { 100: '--darker' } : vm.progress >= 100 ? { 100: '--success' } : { 100: '--primary' }"
                preferred-direction="MORE"
                class="vm-bar"
              />
              <span class="vm-pct text-muted mr-10">{{ vm.progress }}%</span>
            </div>
            <div
              v-if="vm.progress >= 100"
              class="step-label text-muted"
            >
              {{ t('harvester.addons.vmMigration.dashboard.progress.finishedSuccessfully') }}
            </div>
            <div
              v-else-if="vm.errorMsg"
              class="step-label text-error"
            >
              {{ vm.errorMsg }}
            </div>
            <div
              v-else-if="vm.canceled"
              class="step-label text-muted"
            >
              {{ t('harvester.addons.vmMigration.plan.states.canceled') }}
            </div>
            <div
              v-else-if="vm.currentStep"
              class="step-label text-muted"
            >
              {{ vm.currentStep }}
            </div>
          </div>
        </div>
        <span v-if="!row.vmProgress.length">-</span>
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
      font-weight: 500;
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
    gap: 16px;
  }

  .vm-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .vm-name {
    font-size: 14px;
  }

  .vm-name-block {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: center;
  }

  .vm-id {
    font-size: 11px;
  }

  .vm-pct {
    font-size: 14px;
    min-width: 40px;
    text-align: left;
  }

  .vm-pct-block {
    display: flex;
    align-items: center;
    gap: 14px;
    justify-content: space-between;
  }

  .vm-bar {
    width: 100%;
  }

  .step-label {
    font-size: 13px;
    margin-top: 4px;
    line-height: 20px;

    &.text-error {
      color: var(--error);
    }
  }

  .table-title {
    font-weight: 600;
  }
</style>
