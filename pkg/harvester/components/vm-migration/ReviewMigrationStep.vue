<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import { Banner } from '@components/Banner';
import { RcItemCard } from '@components/RcItemCard';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import MappingsCell from '../MappingsCell';
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

const emit = defineEmits(['ready']);

const store = useStore();
const { t } = useI18n(store);

const vms = ref([]);
const networkMappings = ref([]);
const storageMappings = ref([]);
const planName = ref('');
const targetNamespace = ref('');
const namespaceOptions = ref([]);
const errors = ref([]);
const loading = ref(true);

// Restore persisted state
planName.value = props.stepData.planName;
targetNamespace.value = props.stepData.targetNamespace || '';

const NS = FORKLIFT_NAMESPACE;

watch(planName, (val) => {
  props.stepData.planName = val;
}, { immediate: true });

watch(targetNamespace, (val) => {
  props.stepData.targetNamespace = val;
});

watch([planName, targetNamespace], ([name, namespace]) => {
  emit('ready', !!name && !!namespace);
}, { immediate: true });

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

const vmCards = computed(() => {
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

    const vmNetworkMappings = networkMappings.value.filter((m) => m.usedBy && m.usedBy.includes(vm.name || vm.id));
    const vmStorageMappings = storageMappings.value.filter((m) => m.usedBy && m.usedBy.includes(vm.name || vm.id));

    return {
      id:              vm.id,
      name:            vm.name || vm.id,
      os,
      cpus,
      memGB,
      diskDisplay,
      networkMappings: vmNetworkMappings,
      storageMappings: vmStorageMappings,
    };
  });
});

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
  vms.value = props.selectedVms;

  const inStore = store.getters['currentProduct'].inStore;

  try {
    const namespaces = await store.dispatch(`${ inStore }/findAll`, { type: NAMESPACE });

    namespaceOptions.value = namespaces.filter((ns) => !ns.isSystem).map((ns) => ns.metadata.name).sort();
  } catch (e) {
    namespaceOptions.value = [];
  }

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
      <!-- Migration Details Summary -->
      <div class="migration-details">
        <h3 class="section-title m-0">
          {{ t('harvester.addons.vmMigration.reviewMigration.migrationDetails') }}
        </h3>
        <div class="name-row">
          <LabeledSelect
            v-model:value="targetNamespace"
            class="namespace-select"
            :label="t('harvester.addons.vmMigration.reviewMigration.targetNamespace')"
            :placeholder="t('harvester.addons.vmMigration.reviewMigration.targetNamespacePlaceholder')"
            :options="namespaceOptions"
            required
          />
          <LabeledInput
            v-model:value="planName"
            class="name-input"
            :label="t('harvester.addons.vmMigration.reviewMigration.planName')"
            :placeholder="t('harvester.addons.vmMigration.reviewMigration.planNamePlaceholder')"
            required
          />
        </div>
        <div class="details-grid span-9">
          <div class="detail-column">
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.totalVms') }}</span>
              <span class="detail-value detail-value-large">{{ vms.length }}</span>
            </div>
          </div>
          <div class="detail-column">
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.source') }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-value">{{ providerName }}</span>
            </div>
          </div>
          <div class="detail-column">
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.targetNamespace') }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-value">{{ targetNamespace }}</span>
            </div>
          </div>
          <div class="detail-column">
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.vcpu') }}</span>
              <span class="detail-value">{{ totalVCpu }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.memory') }}</span>
              <span class="detail-value">{{ t('harvester.addons.vmMigration.generic.memoryGb', { value: totalMemoryGB }) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.storage') }}</span>
              <span class="detail-value">{{ t('harvester.addons.vmMigration.generic.memoryGb', { value: totalStorageGB }) }}</span>
            </div>
          </div>
          <div class="detail-column grid-column-2">
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.migrationMode') }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-value">
                {{ t('harvester.addons.vmMigration.reviewMigration.coldMigration') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Virtual Machines -->
      <div class="vm-section">
        <h3 class="section-title m-0">
          {{ t('harvester.addons.vmMigration.reviewMigration.virtualMachines') }} ({{ vms.length }})
        </h3>

        <div class="vm-cards-grid">
          <RcItemCard
            v-for="vm in vmCards"
            :id="vm.id"
            :key="vm.id"
            :variant="'small'"
            :header="{ title: { text: vm.name } }"
          >
            <template #item-card-content>
              <div class="vm-card-content">
                <div class="vm-card-specs">
                  <span class="vm-os text-deemphasized">{{ vm.os }}</span>
                  <span class="vm-resources">
                    <i
                      class="icon icon-disk"
                      aria-hidden="true"
                    />
                    {{ t('harvester.addons.vmMigration.generic.vCpu', { count: vm.cpus }) }} &bull; {{ vm.memGB }} &bull; {{ vm.diskDisplay }}
                  </span>
                </div>
                <MappingsCell
                  :network-entries="vm.networkMappings.map(m => `${m.source} → ${m.target}`)"
                  :storage-entries="vm.storageMappings.map(m => `${m.source} → ${m.target}`)"
                />
              </div>
            </template>
          </RcItemCard>
        </div>
      </div>

      <!-- Cold Migration Warning -->
      <Banner
        color="warning"
        class="m-0"
      >
        <div>
          <span class="banner-title">{{ t('harvester.addons.vmMigration.reviewMigration.warningTitle') }}</span><br>
          {{ t('harvester.addons.vmMigration.reviewMigration.warningMessage') }}
        </div>
      </Banner>

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
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;

    .namespace-select {
      max-width: 280px;
      flex-shrink: 0;
    }

    .name-input {
      flex: 1;
    }
  }

  .details-grid {
    display: grid;
    grid-template-columns: minmax(230px, 1fr) 1fr 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px clamp(64px, 8vw, 128px);
    line-height: 20px;
  }

  .detail-column {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &.grid-column-2 {
        grid-column: span 2;
    }
  }

  .detail-item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    .detail-label {
      font-size: 14px;
      color: var(--muted);
    }

    .detail-value {
      font-weight: 600;
      font-size: 14px;

      &.detail-value-large {
        font-size: 24px;
      }
    }
  }

  .vm-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
  }

  .vm-card-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    line-height: 20px;
  }

  .vm-card-specs {
    display: flex;
    flex-direction: row;
    gap: 16px;
    align-items: center;

    .vm-os {
      font-size: 14px;
    }

    .vm-resources {
      font-size: 14px;
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
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
