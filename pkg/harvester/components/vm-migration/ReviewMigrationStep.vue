<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import SortableTable from '@shell/components/SortableTable';
import { Banner } from '@components/Banner';
import { BadgeState } from '@components/BadgeState';
import { RcDropdown, RcDropdownItem, RcDropdownTrigger } from '@components/RcDropdown';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { useI18n } from '@shell/composables/useI18n';
import { NAMESPACE } from '@shell/config/types';
import { HCI } from '../../types';
import { FORKLIFT_NAMESPACE } from '../../config/harvester-map';
import {
  FORKLIFT_API_VERSION, buildNetworkMapEntries, buildStorageMapEntries, bytesToGB, mbToGB
} from '../../utils/forklift';

const props = defineProps({
  providerName:   { type: String, default: '' },
  provider:       { type: Object, default: null },
  selectedVms:    { type: Array, default: () => [] },
  mappingEntries:  { type: Object, default: null },
  stepData:        { type: Object, required: true },
});

const emit = defineEmits(['ready', 'edit-selection', 'edit-mappings', 'remove-vm']);

const store = useStore();
const { t } = useI18n(store);

const vms = computed(() => props.selectedVms);
const networkMappings = ref([]);
const storageMappings = ref([]);
const planName = ref('');
const targetNamespace = ref('');
const namespaceOptions = ref([]);
const existingProviderNames = ref([]);
const existingPlanNames = ref([]);
const errors = ref([]);
const loading = ref(true);

// Restore persisted state
planName.value = props.stepData.planName;
targetNamespace.value = props.stepData.targetNamespace || '';

const NS = FORKLIFT_NAMESPACE;

const nameConflictError = computed(() => {
  const name = (planName.value || '').trim();

  if (!name) {
    return '';
  }

  if (existingProviderNames.value.includes(name)) {
    return t('harvester.addons.vmMigration.reviewMigration.planNameProviderConflict', { name });
  }

  if (existingPlanNames.value.includes(name)) {
    return t('harvester.addons.vmMigration.reviewMigration.planNamePlanConflict', { name });
  }

  return '';
});

watch(planName, (val) => {
  props.stepData.planName = val;
}, { immediate: true });

watch(targetNamespace, (val) => {
  props.stepData.targetNamespace = val;
});

watch([planName, targetNamespace, nameConflictError], () => {
  emit('ready', !!planName.value && !!targetNamespace.value && !nameConflictError.value);
}, { immediate: true });

const formatNetworkTarget = (target = '') => {
  if (target === 'pod') {
    return t('harvester.addons.vmMigration.configureMappings.networkMapping.options.podNetworking');
  }

  if (target === 'ignored') {
    return t('harvester.addons.vmMigration.generic.ignored');
  }

  return target;
};

const totalVCpu = computed(() => vms.value.reduce((sum, vm) => sum + (vm.cpuCount || vm.numCPU || 0), 0));

const totalMemoryGB = computed(() => {
  const totalMB = vms.value.reduce((sum, vm) => sum + (vm.memoryMB || vm.memory || 0), 0);

  return mbToGB(totalMB);
});

const totalStorageGB = computed(() => {
  let totalBytes = 0;

  vms.value.forEach((vm) => {
    if (vm.disks && vm.disks.length > 0) {
      totalBytes += vm.disks.reduce((sum, d) => sum + (d.capacity || 0), 0);
    }
  });

  return bytesToGB(totalBytes);
});

const vmRows = computed(() => {
  return vms.value.map((vm) => {
    const cpus = vm.cpuCount || vm.numCPU || 0;
    const memMB = vm.memoryMB || vm.memory || 0;
    const memGB = memMB ? t('harvester.addons.vmMigration.generic.memoryGb', { value: mbToGB(memMB) }) : '-';

    let totalDiskBytes = 0;

    if (vm.disks && vm.disks.length > 0) {
      totalDiskBytes = vm.disks.reduce((sum, d) => sum + (d.capacity || 0), 0);
    }

    const diskDisplay = totalDiskBytes ? t('harvester.addons.vmMigration.generic.memoryGb', { value: bytesToGB(totalDiskBytes) }) : '-';
    const os = vm.guestName || vm.guestOS || vm.os || '-';
    const rawPowerState = vm.powerState || vm.status?.phase || '-';
    const powerState = rawPowerState.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
    const powerStateClass = powerState.toLowerCase().includes('on') || powerState.toLowerCase().includes('running') ? 'power-on' : 'power-off';

    const vmNetworkMappings = networkMappings.value.filter((m) => m.usedBy && m.usedBy.includes(vm.name || vm.id));
    const vmStorageMappings = storageMappings.value.filter((m) => m.usedBy && m.usedBy.includes(vm.name || vm.id));

    const networkMappingSort = vmNetworkMappings.map((m) => `${ m.source } ${ formatNetworkTarget(m.target) }`).join(', ');
    const storageMappingSort = vmStorageMappings.map((m) => `${ m.source } ${ m.target }`).join(', ');

    return {
      _key:            vm.id || vm.vmId || vm.metadata?.name,
      id:              vm.id,
      name:            vm.name || vm.id,
      identifier:      vm.id || vm.vmId || vm.metadata?.name || '-',
      os,
      resources:       t('harvester.addons.vmMigration.generic.vCpu', { count: cpus }),
      resourcesSub:    `${ memGB } • ${ diskDisplay }`,
      powerState,
      powerStateClass,
      networkMappings: vmNetworkMappings,
      storageMappings: vmStorageMappings,
      networkMapping:  networkMappingSort,
      storageMapping:  storageMappingSort,
    };
  });
});

const vmHeaders = [
  {
    name:     'vmName',
    labelKey: 'harvester.addons.vmMigration.reviewMigration.columns.vmName',
    value:    'name',
    sort:     ['name'],
    subLabel: t('harvester.addons.vmMigration.generic.identifier'),
    width:    200,
  },
  {
    name:     'os',
    labelKey: 'harvester.addons.vmMigration.reviewMigration.columns.os',
    value:    'os',
    sort:     ['os'],
    width:    140,
  },
  {
    name:     'resources',
    labelKey: 'harvester.addons.vmMigration.reviewMigration.columns.resources',
    value:    'resources',
    sort:     false,
    width:    120,
  },
  {
    name:     'powerState',
    labelKey: 'harvester.addons.vmMigration.reviewMigration.columns.powerState',
    value:    'powerState',
    sort:     ['powerState'],
    width:    100,
  },
  {
    name:     'networkMapping',
    labelKey: 'harvester.addons.vmMigration.reviewMigration.columns.networkMapping',
    value:    'networkMapping',
    sort:     ['networkMapping'],
    subLabel: t('harvester.addons.vmMigration.reviewMigration.columns.sourceTarget'),
    width:    220,
  },
  {
    name:     'storageMapping',
    labelKey: 'harvester.addons.vmMigration.reviewMigration.columns.storageMapping',
    value:    'storageMapping',
    sort:     ['storageMapping'],
    subLabel: t('harvester.addons.vmMigration.reviewMigration.columns.sourceTarget'),
    width:    220,
  },
  {
    name:  'actions',
    label: ' ',
    align: 'right',
    sort:  false,
    width: 40,
  },
];

const onEditSelection = () => emit('edit-selection');
const onEditMappings = () => emit('edit-mappings');
const onRemoveVm = (id) => emit('remove-vm', id);

const startMigrationAction = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  const providerRef = {
    source: {
      apiVersion: FORKLIFT_API_VERSION,
      kind:       'Provider',
      name:       props.providerName,
      namespace:  NS,
    },
    destination: {
      apiVersion: FORKLIFT_API_VERSION,
      kind:       'Provider',
      name:       'host',
      namespace:  NS,
    },
  };

  const networkMapName = `${ planName.value }-network-map`;
  const storageMapName = `${ planName.value }-storage-map`;

  const networkMap = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_NETWORK_MAP,
    metadata: { name: networkMapName, namespace: NS },
    spec:     { map: buildNetworkMapEntries(props.mappingEntries?.networkEntries || [], NS), provider: providerRef },
  });

  await networkMap.save();

  const storageMap = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_STORAGE_MAP,
    metadata: { name: storageMapName, namespace: NS },
    spec:     { map: buildStorageMapEntries(props.mappingEntries?.storageEntries || []), provider: providerRef },
  });

  await storageMap.save();

  const plan = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_PLAN,
    metadata: { name: planName.value, namespace: NS },
    spec:     {
      provider: providerRef,
      map:      {
        network: {
          apiVersion: FORKLIFT_API_VERSION,
          kind:       'NetworkMap',
          name:       networkMapName,
          namespace:  NS,
        },
        storage: {
          apiVersion: FORKLIFT_API_VERSION,
          kind:       'StorageMap',
          name:       storageMapName,
          namespace:  NS,
        },
      },
      targetNamespace: targetNamespace.value,
      vms:             vms.value.map((vm) => ({ id: vm.id, name: vm.name || vm.id })),
      warm:            false,
    },
  });

  await plan.save();

  const planOwnerRef = {
    apiVersion:         FORKLIFT_API_VERSION,
    kind:               'Plan',
    name:               plan.metadata.name,
    uid:                plan.metadata.uid,
    blockOwnerDeletion: true,
  };

  networkMap.metadata.ownerReferences = [planOwnerRef];
  await networkMap.save();
  storageMap.metadata.ownerReferences = [planOwnerRef];
  await storageMap.save();

  // Kick off the first migration through the model so the Migration payload
  // lives in a single place (also reused by the dashboard start/restart action).
  await plan.startMigration();
};

const init = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  try {
    const namespaces = await store.dispatch(`${ inStore }/findAll`, { type: NAMESPACE });

    namespaceOptions.value = namespaces.filter((ns) => !ns.isSystem).map((ns) => ns.metadata.name).sort().map((name) => ({ label: name, value: name }));
  } catch (e) {
    namespaceOptions.value = [];
  }

  try {
    await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });
  } catch (e) {}

  existingProviderNames.value = (store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [])
    .map((p) => p.metadata?.name)
    .filter(Boolean);

  try {
    await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PLAN });
  } catch (e) {}

  existingPlanNames.value = (store.getters[`${ inStore }/all`](HCI.FORKLIFT_PLAN) || [])
    .map((p) => p.metadata?.name)
    .filter(Boolean);

  if (props.mappingEntries) {
    networkMappings.value = (props.mappingEntries.networkEntries || []).map((entry) => ({
      source: entry.name || entry.id,
      target: entry.target || '',
      usedBy: entry.usedBy || [],
    }));

    storageMappings.value = (props.mappingEntries.storageEntries || []).map((entry) => ({
      source: entry.name || entry.id,
      target: entry.target || '',
      usedBy: entry.usedBy || [],
    }));
  }

  loading.value = false;
};

init();

defineExpose({ startMigration: startMigrationAction });
</script>

<template>
  <Loading v-if="loading" />
  <div
    v-else
    class="review-migration"
  >
    <div
      class="review-migration-content"
    >
      <Banner
        v-if="nameConflictError"
        color="error"
        :label="nameConflictError"
      />

      <!-- Migration Details Summary -->
      <div class="migration-details">
        <div class="section-header">
          <h3 class="section-title m-0">
            {{ t('harvester.addons.vmMigration.reviewMigration.migrationDetails') }}
          </h3>
          <span class="section-description text-deemphasized">
            {{ t('harvester.addons.vmMigration.reviewMigration.migrationDetailsDescription') }}
          </span>
        </div>

        <div class="name-row">
          <LabeledInput
            v-model:value="planName"
            class="name-input"
            :label="t('harvester.addons.vmMigration.reviewMigration.planName')"
            :placeholder="t('harvester.addons.vmMigration.reviewMigration.planNamePlaceholder')"
            required
          />
          <LabeledSelect
            v-model:value="targetNamespace"
            class="namespace-select"
            :label="t('harvester.addons.vmMigration.reviewMigration.targetNamespace')"
            :placeholder="t('harvester.addons.vmMigration.reviewMigration.targetNamespacePlaceholder')"
            :options="namespaceOptions"
            required
          />
        </div>

        <div class="summary-row">
          <div class="migration-mode-column">
            <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.migrationMode') }}</span>
            <span class="cold-migration-badge">{{ t('harvester.addons.vmMigration.reviewMigration.coldMigration') }}</span>
            <span class="text-deemphasized">{{ t('harvester.addons.vmMigration.reviewMigration.coldMigrationDescription') }}</span>
            <span class="text-deemphasized">{{ t('harvester.addons.vmMigration.reviewMigration.coldMigrationHint') }}</span>
          </div>

          <div class="stats-column">
            <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.provider') }}</span>
            <span class="detail-value">{{ providerName }}</span>
            <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.totalVms') }}</span>
            <span class="detail-value">{{ vms.length }}</span>
            <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.vcpu') }}</span>
            <span class="detail-value">{{ totalVCpu }}</span>
            <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.memory') }}</span>
            <span class="detail-value">{{ t('harvester.addons.vmMigration.generic.memoryGb', { value: totalMemoryGB }) }}</span>
            <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.storage') }}</span>
            <span class="detail-value">{{ t('harvester.addons.vmMigration.generic.memoryGb', { value: totalStorageGB }) }}</span>
          </div>
        </div>
      </div>

      <!-- Virtual Machines -->
      <div class="vm-section">
        <SortableTable
          class="vm-sortable-table"
          :rows="vmRows"
          :headers="vmHeaders"
          :search="false"
          :table-actions="false"
          :row-actions="false"
          :groupable="false"
          :paging="true"
          key-field="_key"
        >
          <template #header-left>
            <h4 class="section-title m-0">
              {{ t('harvester.addons.vmMigration.reviewMigration.virtualMachines') }} ({{ vms.length }})
            </h4>
          </template>
          <template #header-right>
            <a
              href="#"
              class="edit-selection-link"
              @click.prevent="onEditSelection"
            >
              {{ t('harvester.addons.vmMigration.reviewMigration.editSelection') }}
            </a>
          </template>
          <template #cell:vmName="{ row }">
            <div class="vm-name-cell">
              <span class="vm-name">{{ row.name }}</span>
              <span class="vm-id text-deemphasized">{{ row.identifier }}</span>
            </div>
          </template>
          <template #cell:resources="{ row }">
            <span>{{ row.resources }}</span><br>
            <span class="text-deemphasized">{{ row.resourcesSub }}</span>
          </template>
          <template #cell:powerState="{ row }">
            <BadgeState
              :label="row.powerState"
              :color="row.powerStateClass === 'power-on' ? 'bg-warning' : 'bg-darker'"
            />
          </template>
          <template #cell:networkMapping="{ row }">
            <template v-if="row.networkMappings.length">
              <div
                v-for="(m, i) in row.networkMappings"
                :key="'net-' + i"
                class="mapping-cell"
              >
                <span class="mapping-source">{{ m.source }}</span>
                <span class="mapping-target text-deemphasized">&rarr; {{ formatNetworkTarget(m.target) }}</span>
              </div>
            </template>
            <span
              v-else
              class="text-deemphasized"
            >-</span>
          </template>
          <template #cell:storageMapping="{ row }">
            <template v-if="row.storageMappings.length">
              <div
                v-for="(m, i) in row.storageMappings"
                :key="'stor-' + i"
                class="mapping-cell"
              >
                <span class="mapping-source">{{ m.source }}</span>
                <span class="mapping-target text-deemphasized">&rarr; {{ m.target }}</span>
              </div>
            </template>
            <span
              v-else
              class="text-deemphasized"
            >-</span>
          </template>
          <template #cell:actions="{ row }">
            <rc-dropdown :aria-label="t('harvester.addons.vmMigration.reviewMigration.actions.menuLabel')">
              <rc-dropdown-trigger
                variant="ghost"
                :aria-label="t('harvester.addons.vmMigration.reviewMigration.actions.menuLabel')"
              >
                <i class="icon icon-actions" />
              </rc-dropdown-trigger>
              <template #dropdownCollection>
                <rc-dropdown-item @click="onEditMappings">
                  {{ t('harvester.addons.vmMigration.reviewMigration.actions.editMappings') }}
                </rc-dropdown-item>
                <rc-dropdown-item
                  class="text-error"
                  @click="onRemoveVm(row.id)"
                >
                  {{ t('harvester.addons.vmMigration.reviewMigration.actions.removeFromPlan') }}
                </rc-dropdown-item>
              </template>
            </rc-dropdown>
          </template>
          <template #no-rows>
            <tr class="no-rows">
              <td
                :colspan="vmHeaders.length"
                class="text-center"
              >
                {{ t('harvester.addons.vmMigration.reviewMigration.noVmSelected') }}
                <a
                  href="#"
                  class="edit-selection-link"
                  @click.prevent="onEditSelection"
                >{{ t('harvester.addons.vmMigration.reviewMigration.noVmSelectedLink') }}</a>
              </td>
            </tr>
          </template>
        </SortableTable>
      </div>

      <!-- Error banner -->
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .review-migration {
    gap: 36px;
  }

  .review-migration-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-title {
    font-weight: 600;
  }

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px clamp(12px, 1vw, 96px);
    align-items: start;
  }

  .summary-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px clamp(12px, 1vw, 96px);
    line-height: 20px;
    margin-top: 12px;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .section-description {
      font-size: 14px;
    }
  }

  .migration-mode-column {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;

    .cold-migration-badge {
      padding: 2px 10px;
      border-radius: 4px;
      opacity: 0.8;
      font-weight: 600;
      background: rgba(224, 191, 90, 0.16);
      color: #E0BF5A;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;

      .theme-light & {
        background: rgba(168, 128, 26, 0.16);
      }
    }
  }

  .stats-column {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: start;
    align-content: start;
    column-gap: clamp(24px, 4vw, 64px);
    row-gap: 8px;
  }

  .detail-label {
    font-size: 14px;
    color: var(--muted);
  }

  .detail-value {
    font-weight: 600;
    font-size: 14px;
  }

  .edit-selection-link {
    cursor: pointer;
    color: var(--link);
    font-size: 14px;
  }

  .vm-sortable-table {
    :deep(.fixed-header-actions) {
      align-items: end;
    }

    :deep(table) {
      table-layout: fixed;
    }

    :deep(td) {
      vertical-align: middle;
      overflow: hidden;
    }

    :deep(th:first-child),
    :deep(td:first-child) {
      padding-left: 16px;
    }
  }

  .vm-name-cell {
    display: flex;
    flex-direction: column;

    .vm-name {
      font-weight: 600;
    }

    .vm-id {
      font-size: 12px;
    }
  }

  .mapping-cell {
    .mapping-target {
      margin-left: 4px;
      white-space: nowrap;
    }
  }

  .mapping-cell + .mapping-cell {
    margin-top: 8px;
  }

  .banner-title {
    font-weight: 600;
  }

  .migration-details {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  header {
    margin: 0;
  }

  .vm-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
