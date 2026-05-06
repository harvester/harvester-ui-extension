<script>
import { defineComponent, ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RcItemCard } from '@components/RcItemCard';
import { SCHEMA, STORAGE_CLASS, NETWORK_ATTACHMENT } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import vmData from '../../../../utils/vms.json';

const schema = {
  id:         HCI.FORKLIFT_NETWORK_MAP,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_NETWORK_MAP,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_NETWORK_MAP },
};

export default defineComponent({
  name: 'ForkliftConfigureMappings',

  components: {
    Loading,
    Masthead,
    AsyncButton,
    LabeledSelect,
    RcItemCard,
  },

  setup() {
    const store = useStore();
    const route = useRoute();
    const router = useRouter();
    const { t } = useI18n(store);

    const vms = ref([]);
    const harvesterNetworks = ref([]);
    const storageClasses = ref([]);
    const networkEntries = ref([]);
    const storageEntries = ref([]);
    const errors = ref([]);
    const loading = ref(true);

    const providerName = computed(() => route.query.provider || 'vsphere');
    const namespace = computed(() => route.query.namespace || 'default');

    const harvesterNetworkOptions = computed(() => {
      const options = [
        { label: 'Pod Networking', value: 'pod' },
        { label: 'Ignored', value: 'ignored' },
      ];

      harvesterNetworks.value.forEach((net) => {
        const ns = net.metadata?.namespace || '';
        const name = net.metadata?.name || net.id;
        const fullName = ns ? `${ ns }/${ name }` : name;

        options.push({ label: fullName, value: fullName });
      });

      return options;
    });

    const storageClassOptions = computed(() => {
      const options = storageClasses.value.map((sc) => ({
        label: sc.metadata?.name || sc.id,
        value: sc.metadata?.name || sc.id,
      }));

      if (!options.find((o) => o.value === 'harvester-longhorn')) {
        options.unshift({ label: 'harvester-longhorn', value: 'harvester-longhorn' });
      }

      return options;
    });

    const allNetworksMapped = computed(() => networkEntries.value.length > 0 && networkEntries.value.every((e) => !!e.target));
    const allStorageMapped = computed(() => storageEntries.value.length > 0 && storageEntries.value.every((e) => !!e.target));

    const canSave = computed(() => {
      return networkEntries.value.length > 0 && storageEntries.value.length > 0 &&
        allNetworksMapped.value && allStorageMapped.value;
    });

    const buildNetworkEntries = () => {
      const entries = [];

      vms.value.forEach((vm) => {
        if (vm.networks && vm.networks.length > 0) {
          vm.networks.forEach((net) => {
            entries.push({
              vmId:    vm.id,
              vmName:  vm.name || vm.id,
              name:    net.name || 'Unknown',
              id:      net.id || '',
              vlanId:  net.vlanId || '',
              target:  'pod',
              _key:    `net-${ vm.id }-${ net.id || net.name }`,
            });
          });
        } else {
          entries.push({
            vmId:   vm.id,
            vmName: vm.name || vm.id,
            name:   'Default Network',
            id:     '',
            vlanId: '',
            target: 'pod',
            _key:   `net-${ vm.id }-default`,
          });
        }
      });

      networkEntries.value = entries;
    };

    const buildStorageEntries = () => {
      const entries = [];

      vms.value.forEach((vm) => {
        if (vm.disks && vm.disks.length > 0) {
          const seen = new Set();

          vm.disks.forEach((disk) => {
            const ds = disk.datastore;

            if (ds && ds.id && !seen.has(ds.id)) {
              seen.add(ds.id);
              entries.push({
                vmId:     vm.id,
                vmName:   vm.name || vm.id,
                name:     ds.name || 'Unknown',
                id:       ds.id || '',
                type:     ds.type || '',
                capacity: disk.capacity || 0,
                target:   'harvester-longhorn',
                _key:     `stor-${ vm.id }-${ ds.id }`,
              });
            }
          });
        } else {
          entries.push({
            vmId:     vm.id,
            vmName:   vm.name || vm.id,
            name:     'Default Datastore',
            id:       '',
            type:     '',
            capacity: 0,
            target:   'harvester-longhorn',
            _key:     `stor-${ vm.id }-default`,
          });
        }
      });

      storageEntries.value = entries;
    };

    const formatStorageDetail = (entry) => {
      const parts = [];

      if (entry.type) {
        parts.push(entry.type);
      }

      if (entry.capacity) {
        const gb = entry.capacity / (1024 * 1024 * 1024);

        if (gb >= 1024) {
          parts.push(`${ (gb / 1024).toFixed(1) } TB`);
        } else {
          parts.push(`${ Math.round(gb) } GB`);
        }
      }

      return parts.join(' \u2022 ');
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

    const saveMappings = async(buttonCb) => {
      const inStore = store.getters['currentProduct'].inStore;

      const providerRef = {
        source: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'Provider',
          name:       providerName.value,
          namespace:  namespace.value,
        },
        destination: {
          apiVersion: 'forklift.konveyor.io/v1beta1',
          kind:       'Provider',
          name:       'host',
          namespace:  'forklift',
        },
      };

      try {
        // Create NetworkMap
        const networkMapSpec = {
          map: networkEntries.value.map((entry) => {
            if (entry.target === 'pod') {
              return {
                source:      { name: entry.name, id: entry.id },
                destination: { type: 'pod' },
              };
            }

            if (entry.target === 'ignored') {
              return {
                source:      { name: entry.name, id: entry.id },
                destination: { type: 'ignored' },
              };
            }

            return {
              source:      { name: entry.name, id: entry.id },
              destination: {
                type:      'multus',
                name:      entry.target,
                namespace: namespace.value,
              },
            };
          }),
          provider: providerRef,
        };

        const networkMap = await store.dispatch(`${ inStore }/create`, {
          type:     HCI.FORKLIFT_NETWORK_MAP,
          metadata: {
            name:         `${ providerName.value }-network-map-${ Math.random().toString(36).substring(2, 7) }`,
            namespace:    namespace.value,
          },
          spec: networkMapSpec,
        });

        await networkMap.save();

        // Create StorageMap
        const storageMapSpec = {
          map: storageEntries.value.map((entry) => ({
            source:      { name: entry.name, id: entry.id },
            destination: { storageClass: entry.target },
          })),
          provider: providerRef,
        };

        const storageMap = await store.dispatch(`${ inStore }/create`, {
          type:     HCI.FORKLIFT_STORAGE_MAP,
          metadata: {
            name:         `${ providerName.value }-storage-map-${ Math.random().toString(36).substring(2, 7) }`,
            namespace:    namespace.value,
          },
          spec: storageMapSpec,
        });

        await storageMap.save();

        // Navigate to review page with all mapping data
        const networkMappingsData = networkEntries.value.map((entry) => ({
          vmId:   entry.vmId,
          source: entry.name,
          target: entry.target === 'pod' ? 'Pod Networking' : entry.target === 'ignored' ? 'Ignored' : entry.target,
        }));

        const storageMappingsData = storageEntries.value.map((entry) => ({
          vmId:   entry.vmId,
          source: entry.name,
          target: entry.target,
        }));

        router.push({
          name:   `${ PRODUCT_NAME }-c-cluster-forklift-review-migration`,
          params: {
            product: route.params.product,
            cluster: route.params.cluster,
          },
          query: {
            provider:        providerName.value,
            namespace:       namespace.value,
            vms:             route.query.vms,
            networkMap:      networkMap.metadata.name,
            storageMap:      storageMap.metadata.name,
            networkMappings: JSON.stringify(networkMappingsData),
            storageMappings: JSON.stringify(storageMappingsData),
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

      try {
        harvesterNetworks.value = await store.dispatch(`${ inStore }/findAll`, { type: NETWORK_ATTACHMENT });
      } catch (e) {
        harvesterNetworks.value = [];
      }

      try {
        storageClasses.value = await store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS });
      } catch (e) {
        storageClasses.value = [];
      }

      const vmsParam = route.query.vms;

      if (vmsParam) {
        try {
          const vmIds = JSON.parse(vmsParam);

          vms.value = vmIds.map((id) => {
            const found = vmData.find((vm) => vm.id === id);

            return found || {
              id, name: id, networks: [], disks: []
            };
          });
        } catch (e) {
          vms.value = [];
        }
      }

      buildNetworkEntries();
      buildStorageEntries();
      loading.value = false;
    };

    init();

    return {
      schema,
      loading,
      networkEntries,
      storageEntries,
      errors,
      harvesterNetworkOptions,
      storageClassOptions,
      canSave,
      t,
      formatStorageDetail,
      cancel,
      saveMappings,
    };
  },
});
</script>

<template>
  <Loading v-if="loading" />
  <div
    v-else
    class="configure-mappings"
  >
    <Masthead
      :schema="schema"
      :resource="schema.id"
      :type-display="t('harvester.addons.forklift.configureMappings.title')"
      :is-creatable="false"
    >
      <template #subHeader>
        <p class="text-muted line-height-20 mmt-5">
          {{ t('harvester.addons.forklift.configureMappings.description') }}
        </p>
      </template>
    </Masthead>

    <div class="mappings-columns">
      <!-- Network Mapping -->
      <div class="mapping-column">
        <div>
          <h3 class="mapping-section-title">
            {{ t('harvester.addons.forklift.configureMappings.networkMapping.title') }}
          </h3>
          <p class="text-muted line-height-20">
            {{ t('harvester.addons.forklift.configureMappings.networkMapping.description') }}
          </p>
        </div>

        <RcItemCard
          v-for="entry in networkEntries"
          :id="entry._key"
          :key="entry._key"
          :variant="'small'"
          :header="{ title: { text: entry.vmId }, statuses: entry.target ? [{ icon: 'icon-notify-tick', color: 'text-success' }] : [] }"
        >
          <template #item-card-content>
            <div class="card-content-row">
              <div class="mapping-source">
                <span class="source-name">{{ entry.name }}</span>
                <span class="source-id text-muted">{{ entry.id }}</span>
                <span class="source-detail text-muted">VLAN {{ entry.vlanId || '0' }}</span>
              </div>
              <div class="mapping-arrow">
                →
              </div>
              <div class="mapping-target">
                <LabeledSelect
                  v-model:value="entry.target"
                  :options="harvesterNetworkOptions"
                  :placeholder="t('harvester.addons.forklift.configureMappings.networkMapping.placeholder')"
                  :searchable="true"
                />
              </div>
            </div>
          </template>
        </RcItemCard>
      </div>

      <!-- Storage Mapping -->
      <div class="mapping-column">
        <div>
          <h3 class="mapping-section-title">
            {{ t('harvester.addons.forklift.configureMappings.storageMapping.title') }}
          </h3>
          <p class="text-muted">
            {{ t('harvester.addons.forklift.configureMappings.storageMapping.description') }}
          </p>
        </div>

        <RcItemCard
          v-for="entry in storageEntries"
          :id="entry._key"
          :key="entry._key"
          :variant="'small'"
          :header="{ title: { text: entry.vmId }, statuses: entry.target ? [{ icon: 'icon-notify-tick', color: 'text-success' }] : [] }"
        >
          <template #item-card-content>
            <div class="card-content-row">
              <div class="mapping-source">
                <span class="source-name">{{ entry.name }}</span>
                <span class="source-id text-muted">{{ entry.id }}</span>
                <span
                  v-if="entry.type || entry.capacity"
                  class="source-detail text-muted"
                >{{ formatStorageDetail(entry) }}</span>
              </div>
              <div class="mapping-arrow">
                →
              </div>
              <div class="mapping-target">
                <LabeledSelect
                  v-model:value="entry.target"
                  :options="storageClassOptions"
                  :placeholder="t('harvester.addons.forklift.configureMappings.storageMapping.placeholder')"
                  :searchable="true"
                />
              </div>
            </div>
          </template>
        </RcItemCard>
      </div>
    </div>

    <div class="actions-footer">
      <button
        class="btn role-secondary"
        @click="cancel"
      >
        {{ t('generic.cancel') }}
      </button>
      <AsyncButton
        :disabled="!canSave"
        :action-label="t('harvester.addons.forklift.configureMappings.save')"
        :waiting-label="t('harvester.addons.forklift.configureMappings.save')"
        :success-label="t('harvester.addons.forklift.configureMappings.save')"
        :error-label="t('harvester.addons.forklift.configureMappings.save')"
        @click="saveMappings"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .configure-mappings {
    padding: 20px;
  }

  .mappings-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
  }

  .mapping-column {
    display: flex;
    gap: 12px;
    flex-direction: column;
  }

  .mapping-section-title {
    font-weight: 600;
    margin: 0 0 5px 0;
    line-height: 28px;
  }

  .card-content-row {
    display: flex;
    align-items: center;
    gap: 40px;
    width: 100%;
  }

  .mapping-source {
    display: flex;
    flex-direction: column;
    min-width: 160px;
    font-size: 14px;
    line-height: 20px;

    .source-name {
      font-weight: 600;
    }
  }

  .mapping-arrow {
    color: var(--muted);
    font-size: 16px;
    flex-shrink: 0;
  }

  .mapping-target {
    flex: 1;
  }

  .actions-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 30px;
  }

  .line-height-20 {
    line-height: 20px;
  }
</style>
