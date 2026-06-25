<script setup>
import { ref, computed, watch, toRefs } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading';
import { Banner } from '@components/Banner';
import { STORAGE_CLASS, NETWORK_ATTACHMENT } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import { randomStr } from '@shell/utils/string';
import { HCI } from '../../types';
import { FORKLIFT_NAMESPACE } from '../../config/harvester-map';
import MappingColumn from './MappingColumn.vue';

const props = defineProps({
  providerName:       { type: String, default: '' },
  provider:           { type: Object, default: null },
  selectedVms:        { type: Array, default: () => [] },
  stepData:           { type: Object, required: true },
  useAllProviderData: { type: Boolean, default: false },
  existingNetworkMap: { type: Object, default: null },
  existingStorageMap: { type: Object, default: null },
});

const emit = defineEmits(['ready']);

const store = useStore();
const { t } = useI18n(store);

const vms = ref([]);
const harvesterNetworks = ref([]);
const storageClasses = ref([]);
const allNetworkMaps = ref([]);
const allStorageMaps = ref([]);
const errors = ref([]);
const loading = ref(true);

const { networkEntries, storageEntries } = toRefs(props.stepData);

const NAMESPACE = FORKLIFT_NAMESPACE;

const harvesterNetworkOptions = computed(() => {
  const options = [
    { label: t('harvester.addons.vmMigration.configureMappings.networkMapping.options.podNetworking'), value: 'pod' },
    { label: t('harvester.addons.vmMigration.configureMappings.networkMapping.options.ignored'), value: 'ignored' },
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

const applyNetworkMapTargets = (mapSpec) => {
  if (!mapSpec) {
    return;
  }

  networkEntries.value.forEach((entry) => {
    const match = mapSpec.find(
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
};

const applyStorageMapTargets = (mapSpec) => {
  if (!mapSpec) {
    return;
  }

  storageEntries.value.forEach((entry) => {
    const match = mapSpec.find(
      (m) => m.source?.id === entry.id || m.source?.name === entry.name
    );

    if (match?.destination?.storageClass) {
      entry.target = match.destination.storageClass;
    }
  });
};

const applyDefaultNetworkMap = () => {
  const defaultMap = allNetworkMaps.value.find(
    (nm) => nm.metadata.name === `${ props.providerName }-network-map-default`
  );

  applyNetworkMapTargets(defaultMap?.spec?.map);
};

const applyDefaultStorageMap = () => {
  const defaultMap = allStorageMaps.value.find(
    (sm) => sm.metadata.name === `${ props.providerName }-storage-map-default`
  );

  applyStorageMapTargets(defaultMap?.spec?.map);
};

const allNetworksMapped = computed(() => networkEntries.value.length > 0 && networkEntries.value.every((e) => !!e.target));
const allStorageMapped = computed(() => storageEntries.value.length > 0 && storageEntries.value.every((e) => !!e.target));

const canSave = computed(() => {
  if (props.useAllProviderData) {
    return true;
  }

  return networkEntries.value.length > 0 && storageEntries.value.length > 0 &&
    allNetworksMapped.value && allStorageMapped.value;
});

watch(canSave, (val) => {
  emit('ready', val);
});

// After restore, check if ready
if (canSave.value) {
  emit('ready', true);
}

const buildNetworkEntries = () => {
  const networkMap = {};

  vms.value.forEach((vm) => {
    const vmName = vm.name || vm.id;

    if (vm.networks && vm.networks.length > 0) {
      vm.networks.forEach((net) => {
        const netKey = net.id || net.name || 'default';

        if (!networkMap[netKey]) {
          networkMap[netKey] = {
            name:   net.name || t('harvester.addons.vmMigration.generic.unknown'),
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
              name:     ds.name || t('harvester.addons.vmMigration.generic.unknown'),
              id:       ds.id,
              type:     ds.type || '',
              capacity: 0,
              target:   '',
              usedBy:   [],
              _key:     `stor-${ ds.id }`,
            };
          }

          datastoreMap[ds.id].capacity += disk.capacity || 0;

          if (!datastoreMap[ds.id].usedBy.includes(vmName)) {
            datastoreMap[ds.id].usedBy.push(vmName);
          }
        }
      });
    }
  });

  storageEntries.value = Object.values(datastoreMap);
};

const buildNetworkEntriesFromProvider = (networksData) => {
  networkEntries.value = (Array.isArray(networksData) ? networksData : []).map((net) => ({
    name:   net.name || net.id,
    id:     net.id || '',
    vlanId: net.vlanId || '',
    target: '',
    usedBy: [],
    _key:   `net-${ net.id || net.name }`,
  }));
};

const buildStorageEntriesFromProvider = (datastoresData) => {
  storageEntries.value = (Array.isArray(datastoresData) ? datastoresData : []).map((ds) => ({
    name:     ds.name || ds.id,
    id:       ds.id || '',
    type:     ds.type || '',
    capacity: ds.capacity || 0,
    target:   '',
    usedBy:   [],
    _key:     `stor-${ ds.id || ds.name }`,
  }));
};

const formatStorageDetail = (entry) => {
  const parts = [];

  if (entry.type) {
    parts.push(entry.type);
  }

  if (entry.capacity) {
    const gb = entry.capacity / (1024 * 1024 * 1024);

    if (gb >= 1024) {
      parts.push(t('harvester.addons.vmMigration.generic.memoryTb', { value: (gb / 1024).toFixed(1) }));
    } else {
      parts.push(t('harvester.addons.vmMigration.generic.memoryGb', { value: Math.round(gb) }));
    }
  }

  return parts.join(' • ');
};

const buildNetworkMapSpec = (providerRef) => {
  return {
    map: networkEntries.value.filter((entry) => !!entry.target).map((entry) => {
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
};

const buildStorageMapSpec = (providerRef) => {
  return {
    map: storageEntries.value.filter((entry) => !!entry.target).map((entry) => ({
      source:      { name: entry.name, id: entry.id },
      destination: { storageClass: entry.target },
    })),
    provider: providerRef,
  };
};

const saveAndReturn = async() => {
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

  // Update existing maps in place (edit mode)
  if (props.existingNetworkMap && props.existingStorageMap) {
    props.existingNetworkMap.spec = buildNetworkMapSpec(providerRef);
    await props.existingNetworkMap.save();

    props.existingStorageMap.spec = buildStorageMapSpec(providerRef);
    await props.existingStorageMap.save();

    return {
      networkMapName: props.existingNetworkMap.metadata.name,
      storageMapName: props.existingStorageMap.metadata.name,
    };
  }

  const providerOwnerRef = props.provider ? [{
    apiVersion:         'forklift.konveyor.io/v1beta1',
    kind:               'Provider',
    name:               props.provider.metadata.name,
    uid:                props.provider.metadata.uid,
    blockOwnerDeletion: true,
  }] : [];

  const networkMap = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_NETWORK_MAP,
    metadata: {
      name:            `${ props.providerName }-network-map-${ props.useAllProviderData ? 'default' : randomStr(5).toLowerCase() }`,
      namespace:       NAMESPACE,
      ownerReferences: providerOwnerRef,
    },
    spec: buildNetworkMapSpec(providerRef),
  });

  await networkMap.save();

  const storageMap = await store.dispatch(`${ inStore }/create`, {
    type:     HCI.FORKLIFT_STORAGE_MAP,
    metadata: {
      name:            `${ props.providerName }-storage-map-${ props.useAllProviderData ? 'default' : randomStr(5).toLowerCase() }`,
      namespace:       NAMESPACE,
      ownerReferences: providerOwnerRef,
    },
    spec: buildStorageMapSpec(providerRef),
  });

  await storageMap.save();

  return { networkMapName: networkMap.metadata.name, storageMapName: storageMap.metadata.name };
};

defineExpose({ saveMappings: saveAndReturn });

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

  if (networkEntries.value.length === 0 || storageEntries.value.length === 0) {
    try {
      const providerUid = props.provider?.metadata?.uid;
      const providerType = props.provider?.spec?.type || 'vsphere';
      const baseUrl = `https://forklift-apir.13.48.147.135.sslip.io/providers/${ providerType }/${ providerUid }`;

      const [networksData, datastoresData] = await Promise.all([
        fetch(`${ baseUrl }/networks`).then((r) => r.json()).catch(() => []),
        fetch(`${ baseUrl }/datastores?detail=1`).then((r) => r.json()).catch(() => []),
      ]);

      if (props.useAllProviderData) {
        if (networkEntries.value.length === 0) {
          buildNetworkEntriesFromProvider(networksData);
        }
        if (storageEntries.value.length === 0) {
          buildStorageEntriesFromProvider(datastoresData);
        }
      } else {
        vms.value = props.selectedVms;

        const networkNameMap = (Array.isArray(networksData) ? networksData : []).reduce((map, n) => {
          map[n.id] = n.name;

          return map;
        }, {});
        const datastoreInfoMap = (Array.isArray(datastoresData) ? datastoresData : []).reduce((map, d) => {
          map[d.id] = { name: d.name, type: d.type || '' };

          return map;
        }, {});

        vms.value = vms.value.map((vm) => {
          const resolved = { ...vm };

          if (resolved.networks) {
            resolved.networks = resolved.networks.map((n) => ({
              ...n,
              name: n.name || networkNameMap[n.id] || n.id,
            }));
          }

          if (resolved.disks) {
            resolved.disks = resolved.disks.map((d) => {
              const dsInfo = d.datastore ? datastoreInfoMap[d.datastore.id] : null;

              return {
                ...d,
                datastore: d.datastore ? {
                  ...d.datastore,
                  name: d.datastore.name || dsInfo?.name || d.datastore.id,
                  type: dsInfo?.type || '',
                } : d.datastore,
              };
            });
          }

          return resolved;
        });

        if (networkEntries.value.length === 0) {
          buildNetworkEntries();
        }
        if (storageEntries.value.length === 0) {
          buildStorageEntries();
        }
      }
    } catch (e) {
      errors.value = [e?.message || t('harvester.addons.vmMigration.errors.failedResolveDetails')];
    }
  }

  const hasExistingNetworkTargets = networkEntries.value.some((e) => !!e.target);
  const hasExistingStorageTargets = storageEntries.value.some((e) => !!e.target);

  if (!hasExistingNetworkTargets) {
    if (props.existingNetworkMap?.spec?.map) {
      applyNetworkMapTargets(props.existingNetworkMap.spec.map);
    } else {
      applyDefaultNetworkMap();
    }
  }

  if (!hasExistingStorageTargets) {
    if (props.existingStorageMap?.spec?.map) {
      applyStorageMapTargets(props.existingStorageMap.spec.map);
    } else {
      applyDefaultStorageMap();
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
    class="configure-mappings"
  >
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
    />
    <p class="text-deemphasized line-height-20">
      {{ t('harvester.addons.vmMigration.configureMappings.description') }}
    </p>
    <div class="mappings-columns">
      <MappingColumn
        :title="t('harvester.addons.vmMigration.configureMappings.networkMapping.title')"
        :description="t('harvester.addons.vmMigration.configureMappings.networkMapping.description')"
        :entries="networkEntries"
        :options="harvesterNetworkOptions"
        :placeholder="t('harvester.addons.vmMigration.configureMappings.networkMapping.placeholder')"
        :show-used-by="!useAllProviderData"
        :clearable="useAllProviderData"
      >
        <template #source-detail="{ entry }">
          <span class="source-detail text-deemphasized">{{ t('harvester.addons.vmMigration.generic.vlan', { id: entry.vlanId || '0' }) }}</span>
        </template>
      </MappingColumn>

      <MappingColumn
        :title="t('harvester.addons.vmMigration.configureMappings.storageMapping.title')"
        :description="t('harvester.addons.vmMigration.configureMappings.storageMapping.description')"
        :entries="storageEntries"
        :options="storageClassOptions"
        :placeholder="t('harvester.addons.vmMigration.configureMappings.storageMapping.placeholder')"
        :show-used-by="!useAllProviderData"
        :clearable="useAllProviderData"
      >
        <template #source-detail="{ entry }">
          <span
            v-if="entry.type || entry.capacity"
            class="source-detail text-deemphasized"
          >{{ formatStorageDetail(entry) }}</span>
        </template>
      </MappingColumn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .mappings-columns {
    display: flex;
    flex-direction: column;
    gap: 32px;

    @media only screen and (min-width: map-get($breakpoints, '--viewport-7')) {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    @media only screen and (min-width: map-get($breakpoints, '--viewport-9')) {
      gap: 48px;
    }

    @media only screen and (min-width: map-get($breakpoints, '--viewport-12')) {
      gap: 64px;
    }
  }

  .configure-mappings {
    display: flex;
    flex-direction: column;
    gap: 24px;

    .line-height-20 {
      line-height: 20px;
    }
  }

  .source-detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
