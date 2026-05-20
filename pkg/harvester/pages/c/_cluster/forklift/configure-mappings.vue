<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RcItemCard } from '@components/RcItemCard';
import { SCHEMA, STORAGE_CLASS, NETWORK_ATTACHMENT } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { currentRouter, currentRoute } from '../../../../utils/router';

const schema = {
  id:         HCI.FORKLIFT_NETWORK_MAP,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_NETWORK_MAP,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_NETWORK_MAP },
};

const store = useStore();
const { t } = useI18n(store);

const NO_TEMPLATE = '__none__';

const vms = ref([]);
const harvesterNetworks = ref([]);
const storageClasses = ref([]);
const networkEntries = ref([]);
const storageEntries = ref([]);
const allNetworkMaps = ref([]);
const allStorageMaps = ref([]);
const selectedNetworkTemplate = ref(NO_TEMPLATE);
const selectedStorageTemplate = ref(NO_TEMPLATE);
const errors = ref([]);
const loading = ref(true);

const NAMESPACE = 'forklift';
const providerName = computed(() => currentRoute().query.provider || 'vsphere');

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

const networkTemplateOptions = computed(() => {
  const options = [
    { label: t('harvester.addons.forklift.configureMappings.noTemplate'), value: NO_TEMPLATE }
  ];

  const currentIds = new Set(networkEntries.value.map((e) => e.id).filter(Boolean));

  const sorted = [...allNetworkMaps.value].sort(
    (a, b) => new Date(b.metadata.creationTimestamp) - new Date(a.metadata.creationTimestamp)
  );

  sorted.forEach((nm) => {
    const mapSources = (nm.spec?.map || []).map((m) => m.source?.id).filter(Boolean);
    const hasOverlap = mapSources.some((id) => currentIds.has(id));

    if (hasOverlap) {
      options.push({
        label: nm.metadata.name,
        value: nm.metadata.name,
      });
    }
  });

  return options;
});

const storageTemplateOptions = computed(() => {
  const options = [
    { label: t('harvester.addons.forklift.configureMappings.noTemplate'), value: NO_TEMPLATE }
  ];

  const currentIds = new Set(storageEntries.value.map((e) => e.id).filter(Boolean));

  const sorted = [...allStorageMaps.value].sort(
    (a, b) => new Date(b.metadata.creationTimestamp) - new Date(a.metadata.creationTimestamp)
  );

  sorted.forEach((sm) => {
    const mapSources = (sm.spec?.map || []).map((m) => m.source?.id).filter(Boolean);
    const hasOverlap = mapSources.some((id) => currentIds.has(id));

    if (hasOverlap) {
      options.push({
        label: sm.metadata.name,
        value: sm.metadata.name,
      });
    }
  });

  return options;
});

watch(selectedNetworkTemplate, (val) => {
  if (val === NO_TEMPLATE) {
    networkEntries.value.forEach((e) => {
      e.target = '';
    });

    return;
  }

  const template = allNetworkMaps.value.find((nm) => nm.metadata.name === val);

  if (!template?.spec?.map) {
    return;
  }

  networkEntries.value.forEach((entry) => {
    const match = template.spec.map.find(
      (m) => m.source?.id === entry.id || m.source?.name === entry.name
    );

    if (match?.destination) {
      const dest = match.destination;

      if (dest.type === 'pod') {
        entry.target = 'pod';
      } else if (dest.type === 'ignored') {
        entry.target = 'ignored';
      } else if (dest.type === 'multus' && dest.name) {
        entry.target = dest.namespace ? `${ dest.namespace }/${ dest.name }` : dest.name;
      }
    }
  });
});

watch(selectedStorageTemplate, (val) => {
  if (val === NO_TEMPLATE) {
    storageEntries.value.forEach((e) => {
      e.target = '';
    });

    return;
  }

  const template = allStorageMaps.value.find((sm) => sm.metadata.name === val);

  if (!template?.spec?.map) {
    return;
  }

  storageEntries.value.forEach((entry) => {
    const match = template.spec.map.find(
      (m) => m.source?.id === entry.id || m.source?.name === entry.name
    );

    if (match?.destination?.storageClass) {
      entry.target = match.destination.storageClass;
    }
  });
});

const allNetworksMapped = computed(() => networkEntries.value.length > 0 && networkEntries.value.every((e) => !!e.target));
const allStorageMapped = computed(() => storageEntries.value.length > 0 && storageEntries.value.every((e) => !!e.target));

const canSave = computed(() => {
  return networkEntries.value.length > 0 && storageEntries.value.length > 0 &&
    allNetworksMapped.value && allStorageMapped.value;
});

const buildNetworkEntries = () => {
  const networkMap = {};

  vms.value.forEach((vm) => {
    const vmName = vm.name || vm.id;

    if (vm.networks && vm.networks.length > 0) {
      vm.networks.forEach((net) => {
        const netKey = net.id || net.name || 'default';

        if (!networkMap[netKey]) {
          networkMap[netKey] = {
            name:   net.name || 'Unknown',
            id:     net.id || '',
            vlanId: net.vlanId || '',
            target: '',
            usedBy: [],
            _key:   `net-${ netKey }`,
          };
        }

        if (!networkMap[netKey].usedBy.includes(vmName)) {
          networkMap[netKey].usedBy.push(vmName);
        }
      });
    }
  });

  networkEntries.value = Object.values(networkMap);
};

const buildStorageEntries = () => {
  const datastoreMap = {};

  vms.value.forEach((vm) => {
    const vmName = vm.name || vm.id;

    if (vm.disks && vm.disks.length > 0) {
      vm.disks.forEach((disk) => {
        const ds = disk.datastore;

        if (ds && ds.id) {
          if (!datastoreMap[ds.id]) {
            datastoreMap[ds.id] = {
              name:     ds.name || 'Unknown',
              id:       ds.id,
              type:     ds.type || '',
              capacity: ds.capacity || 0,
              target:   '',
              usedBy:   [],
              _key:     `stor-${ ds.id }`,
            };
          }

          if (!datastoreMap[ds.id].usedBy.includes(vmName)) {
            datastoreMap[ds.id].usedBy.push(vmName);
          }
        }
      });
    }
  });

  storageEntries.value = Object.values(datastoreMap);
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
  currentRouter().push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
    params: {
      product: store.getters['productId'],
      cluster: store.getters['clusterId'],
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
      namespace:  NAMESPACE,
    },
    destination: {
      apiVersion: 'forklift.konveyor.io/v1beta1',
      kind:       'Provider',
      name:       'host',
      namespace:  NAMESPACE,
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

        const parts = entry.target.split('/');
        const netName = parts.length > 1 ? parts[1] : parts[0];
        const netNamespace = parts.length > 1 ? parts[0] : NAMESPACE;

        return {
          source:      { name: entry.name, id: entry.id },
          destination: {
            type:      'multus',
            name:      netName,
            namespace: netNamespace,
          },
        };
      }),
      provider: providerRef,
    };

    // Fetch the Provider to build ownerReference
    const allProviders = store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [];
    const provider = allProviders.find((p) => p.metadata.name === providerName.value && p.metadata.namespace === NAMESPACE);

    const providerOwnerRef = provider ? [{
      apiVersion:         'forklift.konveyor.io/v1beta1',
      kind:               'Provider',
      name:               provider.metadata.name,
      uid:                provider.metadata.uid,
      blockOwnerDeletion: true,
    }] : [];

    const networkMap = await store.dispatch(`${ inStore }/create`, {
      type:     HCI.FORKLIFT_NETWORK_MAP,
      metadata: {
        name:            `${ providerName.value }-network-map-${ Math.random().toString(36).substring(2, 7) }`,
        namespace:       NAMESPACE,
        ownerReferences: providerOwnerRef,
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
        name:            `${ providerName.value }-storage-map-${ Math.random().toString(36).substring(2, 7) }`,
        namespace:       NAMESPACE,
        ownerReferences: providerOwnerRef,
      },
      spec: storageMapSpec,
    });

    await storageMap.save();

    // Navigate to review page
    currentRouter().push({
      name:   `${ PRODUCT_NAME }-c-cluster-forklift-review-migration`,
      params: {
        product: store.getters['productId'],
        cluster: store.getters['clusterId'],
      },
      query: {
        provider:   providerName.value,
        vms:        currentRoute().query.vms,
        networkMap: networkMap.metadata.name,
        storageMap: storageMap.metadata.name,
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

  try {
    allNetworkMaps.value = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP });
  } catch (e) {
    allNetworkMaps.value = [];
  }

  try {
    allStorageMaps.value = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP });
  } catch (e) {
    allStorageMaps.value = [];
  }

  try {
    await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });
  } catch (e) {
    // Provider may already be in store from previous step
  }

  const allProviders = store.getters[`${ inStore }/all`](HCI.FORKLIFT_PROVIDER) || [];
  const provider = allProviders.find((p) => p.metadata.name === providerName.value && p.metadata.namespace === NAMESPACE);

  const vmsParam = currentRoute().query.vms;

  if (vmsParam) {
    try {
      const vmIds = JSON.parse(vmsParam);
      const providerUid = provider?.metadata?.uid;
      const providerType = provider?.spec?.type || 'vsphere';
      const baseUrl = `https://forklift-apir.13.48.147.135.sslip.io/providers/${ providerType }/${ providerUid }`;

      const [allVms, networksData, datastoresData] = await Promise.all([
        fetch(`${ baseUrl }/vms`).then((r) => r.json()).catch(() => []),
        fetch(`${ baseUrl }/networks`).then((r) => r.json()).catch(() => []),
        fetch(`${ baseUrl }/datastores`).then((r) => r.json()).catch(() => []),
      ]);

      const networkNameMap = (Array.isArray(networksData) ? networksData : []).reduce((map, n) => {
        map[n.id] = n.name;

        return map;
      }, {});
      const datastoreNameMap = (Array.isArray(datastoresData) ? datastoresData : []).reduce((map, d) => {
        map[d.id] = d.name;

        return map;
      }, {});

      const vmList = Array.isArray(allVms) ? allVms : (allVms?.data || []);

      vms.value = vmIds.map((id) => {
        const found = vmList.find((vm) => vm.id === id);

        if (found) {
          // Resolve network names
          if (found.networks) {
            found.networks = found.networks.map((n) => ({
              ...n,
              name: n.name || networkNameMap[n.id] || n.id,
            }));
          }

          // Resolve datastore names
          if (found.disks) {
            found.disks = found.disks.map((d) => ({
              ...d,
              datastore: d.datastore ? {
                ...d.datastore,
                name: d.datastore.name || datastoreNameMap[d.datastore.id] || d.datastore.id,
              } : d.datastore,
            }));
          }

          return found;
        }

        return {
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

        <LabeledSelect
          v-model:value="selectedNetworkTemplate"
          :label="t('harvester.addons.forklift.configureMappings.networkMapping.template')"
          :options="networkTemplateOptions"
          :reduce="(opt) => opt.value"
          class="mb-10"
        />

        <RcItemCard
          v-for="entry in networkEntries"
          :id="entry._key"
          :key="entry._key"
          :variant="'small'"
          :header="{}"
          class="bg-light-gray"
        >
          <template #item-card-content>
            <div class="card-content-column">
              <div class="card-content-row">
                <div class="mapping-source">
                  <span class="source-name">{{ entry.name }}</span>
                  <span class="source-detail text-muted">VLAN {{ entry.vlanId || '0' }}</span>
                </div>
                <div :class="['mapping-arrow', entry.target ? 'text-success' : 'text-muted']">
                  <i class="icon icon-right-arrow-alt" />
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
              <div>
                <span class="used-by">
                  Used by: <b>{{ entry.usedBy.join(', ') }}</b>
                </span>
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

        <LabeledSelect
          v-model:value="selectedStorageTemplate"
          :label="t('harvester.addons.forklift.configureMappings.storageMapping.template')"
          :options="storageTemplateOptions"
          :reduce="(opt) => opt.value"
          class="mb-10"
        />

        <RcItemCard
          v-for="entry in storageEntries"
          :id="entry._key"
          :key="entry._key"
          :variant="'small'"
          :header="{}"
          class="bg-light-gray"
        >
          <template #item-card-content>
            <div class="card-content-column">
              <div class="card-content-row">
                <div class="mapping-source">
                  <span class="source-name">{{ entry.name }}</span>
                  <span
                    v-if="entry.type || entry.capacity"
                    class="source-detail text-muted"
                  >{{ formatStorageDetail(entry) }}</span>
                </div>
                <div :class="['mapping-arrow', entry.target ? 'text-success' : 'text-muted']">
                  <i class="icon icon-right-arrow-alt" />
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
              <div>
                <span class="used-by">
                  Used by: <b>{{ entry.usedBy.join(', ') }}</b>
                </span>
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
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 64px;
  }

  .mapping-column {
    display: flex;
    gap: 12px;
    flex-direction: column;

    :deep(.item-card-header) {
      display: none;
    }
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

  .card-content-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
      font-size: 16px;
    }

    .used-by {
      margin-top: 4px;
      font-size: 14px;
      line-height: 24px;
    }
  }

  .mapping-arrow {
    font-size: 22px;
    flex-shrink: 0;
  }

  .mapping-target {
    flex: 1;
    overflow: hidden;
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

  .bg-light-gray {
    background-color: var(--category-active) !important;
    border: 0;
  }

</style>
