<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import { Banner } from '@components/Banner';
import { RcItemCard } from '@components/RcItemCard';
import { LabeledInput } from '@components/Form/LabeledInput';
import MappingsCell from '../MappingsCell';
import { useI18n } from '@shell/composables/useI18n';
import { randomStr } from '@shell/utils/string';
import { HCI } from '../../types';
import { FORKLIFT_NAMESPACE } from '../../config/harvester-map';

const props = defineProps({
  providerName:   { type: String, default: '' },
  provider:       { type: Object, default: null },
  selectedVms:    { type: Array, default: () => [] },
  networkMapName:  { type: String, default: '' },
  storageMapName:  { type: String, default: '' },
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
const errors = ref([]);
const loading = ref(true);

// Restore persisted state
planName.value = props.stepData.planName;

const NAMESPACE = FORKLIFT_NAMESPACE;
const TARGET_NAMESPACE = 'default';

watch(planName, (val) => {
  props.stepData.planName = val;
  emit('ready', !!val);
}, { immediate: true });

const totalVCpu = computed(() => vms.value.reduce((sum, vm) => sum + (vm.cpuCount || vm.numCPU || 0), 0));

const totalMemoryGB = computed(() => {
  const totalMB = vms.value.reduce((sum, vm) => sum + (vm.memoryMB || vm.memory || 0), 0);

  return Math.round(totalMB / 1024);
});

const totalStorageGB = computed(() => {
  let totalBytes = 0;

  vms.value.forEach((vm) => {
    if (vm.disks && vm.disks.length > 0) {
      totalBytes += vm.disks.reduce((sum, d) => sum + (d.capacity || 0), 0);
    }
  });

  return Math.round(totalBytes / (1024 * 1024 * 1024));
});

const vmCards = computed(() => {
  return vms.value.map((vm) => {
    const cpus = vm.cpuCount || vm.numCPU || 0;
    const memMB = vm.memoryMB || vm.memory || 0;
    const memGB = memMB ? `${ Math.round(memMB / 1024) } GB` : '-';

    let totalDiskBytes = 0;

    if (vm.disks && vm.disks.length > 0) {
      totalDiskBytes = vm.disks.reduce((sum, d) => sum + (d.capacity || 0), 0);
    }

    const diskDisplay = totalDiskBytes ? `${ Math.round(totalDiskBytes / (1024 * 1024 * 1024)) } GB` : '-';
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

const buildNetworkMapSpec = () => {
  const entries = props.mappingEntries?.networkEntries || [];

  return entries.map((entry) => {
    if (entry.target === 'pod') {
      return { source: { name: entry.name, id: entry.id }, destination: { type: 'pod' } };
    }

    if (entry.target === 'ignored') {
      return { source: { name: entry.name, id: entry.id }, destination: { type: 'ignored' } };
    }

    const parts = entry.target.split('/');
    const netName = parts.length > 1 ? parts[1] : parts[0];
    const netNamespace = parts.length > 1 ? parts[0] : NAMESPACE;

    return {
      source:      { name: entry.name, id: entry.id },
      destination: {
        type: 'multus', name: netName, namespace: netNamespace
      },
    };
  });
};

const buildStorageMapSpec = () => {
  const entries = props.mappingEntries?.storageEntries || [];

  return entries.map((entry) => ({
    source:      { name: entry.name, id: entry.id },
    destination: { storageClass: entry.target },
  }));
};

const startMigrationAction = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  const providerRef = {
    source: {
      apiVersion: 'forklift.konveyor.io/v1beta1',
      kind:       'Provider',
      name:       props.providerName,
      namespace:  NAMESPACE,
    },
    destination: {
      apiVersion: 'forklift.konveyor.io/v1beta1',
      kind:       'Provider',
      name:       'host',
      namespace:  NAMESPACE,
    },
  };

  const networkMapName = `${ planName.value }-network-map`;
  const storageMapName = `${ planName.value }-storage-map`;

  const networkMap = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_NETWORK_MAP,
    metadata: { name: networkMapName, namespace: NAMESPACE },
    spec:     { map: buildNetworkMapSpec(), provider: providerRef },
  });

  await networkMap.save();

  const storageMap = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_STORAGE_MAP,
    metadata: { name: storageMapName, namespace: NAMESPACE },
    spec:     { map: buildStorageMapSpec(), provider: providerRef },
  });

  await storageMap.save();

  const plan = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_PLAN,
    metadata: { name: planName.value, namespace: NAMESPACE },
    spec:     {
      provider: providerRef,
      map:      {
        network: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'NetworkMap',
          name:       networkMapName,
          namespace:  NAMESPACE,
        },
        storage: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'StorageMap',
          name:       storageMapName,
          namespace:  NAMESPACE,
        },
      },
      targetNamespace: 'default',
      vms:             vms.value.map((vm) => ({ id: vm.id, name: vm.name || vm.id })),
      warm:            false,
    },
  });

  await plan.save();

  const planOwnerRef = {
    apiVersion:         'forklift.konveyor.io/v1beta1',
    kind:               'Plan',
    name:               plan.metadata.name,
    uid:                plan.metadata.uid,
    blockOwnerDeletion: true,
  };

  const migration = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_MIGRATION,
    metadata: {
      name:            `${ planName.value }-migration-${ randomStr(5).toLowerCase() }`,
      namespace:       NAMESPACE,
      ownerReferences: [planOwnerRef],
    },
    spec: {
      plan: {
        apiVersion: 'forklift.konveyor.io/v1beta1',
        kind:       'Plan',
        name:       planName.value,
        namespace:  NAMESPACE,
      },
    },
  });

  await migration.save();

  networkMap.metadata.ownerReferences = [planOwnerRef];
  await networkMap.save();
  storageMap.metadata.ownerReferences = [planOwnerRef];
  await storageMap.save();
};

const init = () => {
  vms.value = props.selectedVms;

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
        <div class="span-9">
          <LabeledInput
            v-model:value="planName"
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
              <span class="detail-value">{{ TARGET_NAMESPACE }}</span>
            </div>
          </div>
          <div class="detail-column">
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.vcpu') }}</span>
              <span class="detail-value">{{ totalVCpu }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.memory') }}</span>
              <span class="detail-value">{{ totalMemoryGB }} GB</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ t('harvester.addons.vmMigration.reviewMigration.storage') }}</span>
              <span class="detail-value">{{ totalStorageGB }} GB</span>
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
                    {{ vm.cpus }} vCPU &bull; {{ vm.memGB }} &bull; {{ vm.diskDisplay }}
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

  .vm-card-mappings {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .mapping-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;

    .icon {
      color: var(--muted);
      font-size: 14px;
    }
  }

  .small-text {
    font-size: 12px;
    line-height: 16px;
    color: #973C00;
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
