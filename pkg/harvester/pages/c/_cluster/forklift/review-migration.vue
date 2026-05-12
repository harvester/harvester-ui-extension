<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import AsyncButton from '@shell/components/AsyncButton';
import { Banner } from '@components/Banner';
import { RcItemCard } from '@components/RcItemCard';
import MappingsCell from '../../../../components/MappingsCell';
import { SCHEMA } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { currentRouter, currentRoute } from '../../../../utils/router';

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

const vms = ref([]);
const networkMappings = ref([]);
const storageMappings = ref([]);
const errors = ref([]);
const loading = ref(true);

const NAMESPACE = 'forklift';
const TARGET_NAMESPACE = 'default';
const providerName = computed(() => currentRoute().query.provider || 'vsphere');
const networkMapName = computed(() => currentRoute().query.networkMap || '');
const storageMapName = computed(() => currentRoute().query.storageMap || '');

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

const cancel = async() => {
  const inStore = store.getters['currentProduct'].inStore;
  const allProviders = store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [];
  const provider = allProviders.find((p) => p.metadata.name === providerName.value && p.metadata.namespace === NAMESPACE);

  if (provider) {
    await provider.remove();
  }

  currentRouter().push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
    params: {
      product: store.getters['productId'],
      cluster: store.getters['clusterId'],
    }
  });
};

const startMigration = async(buttonCb) => {
  const inStore = store.getters['currentProduct'].inStore;

  try {
    const planName = `${ providerName.value }`;

    const planSpec = {
      provider: {
        source: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'Provider',
          name:       providerName.value,
          namespace:  NAMESPACE,
        },
        destination: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'Provider',
          name:       'host',
          namespace:  NAMESPACE,
        },
      },
      map: {
        network: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'NetworkMap',
          name:       networkMapName.value,
          namespace:  NAMESPACE,
        },
        storage: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'StorageMap',
          name:       storageMapName.value,
          namespace:  NAMESPACE,
        },
      },
      targetNamespace: 'default',
      vms:             vms.value.map((vm) => ({
        id:   vm.id,
        name: vm.name || vm.id,
      })),
      warm: false,
    };

    const plan = await store.dispatch(`${ inStore }/create`, {
      type:     HCI.FORKLIFT_PLAN,
      metadata: {
        name:      planName,
        namespace: NAMESPACE,
      },
      spec: planSpec,
    });

    await plan.save();

    // Build ownerReference pointing to the Plan
    const planOwnerRef = {
      apiVersion:         'forklift.konveyor.io/v1beta1',
      kind:               'Plan',
      name:               plan.metadata.name,
      uid:                plan.metadata.uid,
      blockOwnerDeletion: true,
    };

    // Create Migration owned by Plan
    const migrationName = `${ planName }-migration-${ Math.random().toString(36).substring(2, 7) }`;

    const migration = await store.dispatch(`${ inStore }/create`, {
      type:     HCI.FORKLIFT_MIGRATION,
      metadata: {
        name:            migrationName,
        namespace:       NAMESPACE,
        ownerReferences: [planOwnerRef],
      },
      spec: {
        plan: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'Plan',
          name:       planName,
          namespace:  NAMESPACE,
        },
      },
    });

    await migration.save();

    // Set Plan as owner of Provider (Provider already owns NetworkMap, StorageMap, Secret)
    const allProviders = store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [];
    const provider = allProviders.find((p) => p.metadata.name === providerName.value && p.metadata.namespace === NAMESPACE);

    if (provider) {
      provider.metadata.ownerReferences = [
        ...(provider.metadata.ownerReferences || []),
        planOwnerRef,
      ];
      await provider.save();
    }

    currentRouter().push({
      name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
      params: {
        product: store.getters['productId'],
        cluster: store.getters['clusterId'],
      }
    });

    buttonCb(true);
  } catch (err) {
    errors.value = [err.message || err];
    buttonCb(false);
  }
};

const init = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER }).catch(() => {});

  const allProviders = store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [];
  const provider = allProviders.find((p) => p.metadata.name === providerName.value && p.metadata.namespace === NAMESPACE);

  const vmsParam = currentRoute().query.vms;

  if (vmsParam) {
    try {
      const vmIds = JSON.parse(vmsParam);
      const providerUid = provider?.metadata?.uid;
      const providerType = provider?.spec?.type || 'vsphere';
      const baseUrl = `https://forklift-apir.13.48.147.135.sslip.io/providers/${ providerType }/${ providerUid }`;
      const allVms = await fetch(`${ baseUrl }/vms`).then((r) => r.json()).catch(() => []);
      const vmList = Array.isArray(allVms) ? allVms : (allVms?.data || []);

      vms.value = vmIds.map((id) => {
        const found = vmList.find((vm) => vm.id === id);

        return found || {
          id, name: id, networks: [], disks: [], cpuCount: 0, memoryMB: 0, guestName: ''
        };
      });
    } catch (e) {
      vms.value = [];
    }
  }

  const networkMappingsParam = currentRoute().query.networkMappings;

  if (networkMappingsParam) {
    try {
      networkMappings.value = JSON.parse(networkMappingsParam);
    } catch (e) {
      networkMappings.value = [];
    }
  }

  const storageMappingsParam = currentRoute().query.storageMappings;

  if (storageMappingsParam) {
    try {
      storageMappings.value = JSON.parse(storageMappingsParam);
    } catch (e) {
      storageMappings.value = [];
    }
  }

  loading.value = false;
};

init();
</script>

<template>
  <Loading v-if="loading" />
  <div
    v-else
    class="review-migration"
  >
    <Masthead
      :schema="schema"
      :resource="schema.id"
      :type-display="t('harvester.addons.forklift.reviewMigration.title')"
      :is-creatable="false"
    >
      <template #subHeader>
        <p class="text-muted mt-5">
          {{ t('harvester.addons.forklift.reviewMigration.description') }}
        </p>
      </template>
    </Masthead>

    <!-- Migration Details Summary -->
    <div class="migration-details">
      <h3 class="section-title">
        {{ t('harvester.addons.forklift.reviewMigration.migrationDetails') }}
      </h3>
      <div class="details-grid">
        <div class="detail-column">
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.totalVms') }}</span>
            <span class="detail-value detail-value-large">{{ vms.length }}</span>
          </div>
        </div>
        <div class="detail-column">
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.source') }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-value">{{ providerName }}</span>
          </div>
        </div>
        <div class="detail-column">
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.targetNamespace') }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-value">{{ TARGET_NAMESPACE }}</span>
          </div>
        </div>
        <div class="detail-column">
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.vcpu') }}</span>
            <span class="detail-value">{{ totalVCpu }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.memory') }}</span>
            <span class="detail-value">{{ totalMemoryGB }} GB</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.storage') }}</span>
            <span class="detail-value">{{ totalStorageGB }} GB</span>
          </div>
        </div>
        <div class="detail-column grid-column-2">
          <div class="detail-item">
            <span class="detail-label">{{ t('harvester.addons.forklift.reviewMigration.migrationMode') }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-value">
              {{ t('harvester.addons.forklift.reviewMigration.coldMigration') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Virtual Machines -->
    <div class="vm-section">
      <h3 class="section-title">
        {{ t('harvester.addons.forklift.reviewMigration.virtualMachines') }} ({{ vms.length }})
      </h3>

      <div class="vm-cards-grid">
        <RcItemCard
          v-for="vm in vmCards"
          :id="vm.id"
          :key="vm.id"
          :variant="'small'"
          :header="{ title: { text: vm.name }, statuses: [{ icon: 'icon-notify-tick', color: 'text-success' }] }"
        >
          <template #item-card-content>
            <div class="vm-card-content">
              <div class="vm-card-specs">
                <span class="vm-os text-muted">{{ vm.os }}</span>
                <span class="vm-resources">
                  <i class="icon icon-disk" />
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
      class="mt-20"
    >
      <div>
        <span class="banner-title">{{ t('harvester.addons.forklift.reviewMigration.warningTitle') }}</span><br>
        {{ t('harvester.addons.forklift.reviewMigration.warningMessage') }}
      </div>
    </Banner>

    <!-- Error banner -->
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
      class="mt-10"
    />

    <!-- Actions -->
    <div class="actions-footer">
      <button
        class="btn role-secondary"
        @click="cancel"
      >
        {{ t('generic.cancel') }}
      </button>
      <AsyncButton
        :action-label="t('harvester.addons.forklift.reviewMigration.startMigration')"
        :waiting-label="t('harvester.addons.forklift.reviewMigration.startMigration')"
        :success-label="t('harvester.addons.forklift.reviewMigration.startMigration')"
        :error-label="t('harvester.addons.forklift.reviewMigration.startMigration')"
        @click="startMigration"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .review-migration {
    padding: 20px;
  }

  .section-title {
    font-weight: 600;
    margin: 0 0 15px 0;
  }

  .migration-details {
    margin-bottom: 30px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: minmax(230px, 1fr) 1fr 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px 128px;
    width: 747px;
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

  .vm-section {
    margin-top: 30px;
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

  .actions-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 30px;
  }

  .banner-title {
    font-weight: 600;
  }

</style>
