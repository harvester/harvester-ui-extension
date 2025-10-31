<script>
import { STATE, NAME } from '@shell/config/table-headers';
import { allHash } from '@shell/utils/promise';
import Banner from '@components/Banner/Banner.vue';
import Loading from '@shell/components/Loading';
import ResourceTable from '@shell/components/ResourceTable';
import { HCI } from '../types';
import { ADD_ONS } from '../config/harvester-map';
import MessageLink from '@shell/components/MessageLink';

export default {
  name: 'ListMIGConfigurations',

  inheritAttrs: false,

  components: {
    Banner,
    Loading,
    ResourceTable,
    MessageLink,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.schema = this.$store.getters[`${ inStore }/schemaFor`](HCI.MIG_CONFIGURATION);
    this.hasAddonSchema = this.$store.getters[`${ inStore }/schemaFor`](HCI.ADD_ONS);

    if (this.hasSchema) {
      try {
        const hash = await allHash({
          migconfigs:  this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.MIG_CONFIGURATION }),
          vGpuDevices: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VGPU_DEVICE }),
          addons:      this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.ADD_ONS })
        });

        this.hasPCIAddon = hash.addons.find((addon) => addon.name === ADD_ONS.PCI_DEVICE_CONTROLLER)?.spec?.enabled === true;
        this.hasSriovgpuAddon = hash.addons.find((addon) => addon.name === ADD_ONS.NVIDIA_DRIVER_TOOLKIT_CONTROLLER)?.spec?.enabled === true;
        this.hasSRIOVGPUSchema = !!this.$store.getters[`${ inStore }/schemaFor`](HCI.SR_IOVGPU_DEVICE);

        if (this.hasSRIOVGPUSchema) {
          await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SR_IOVGPU_DEVICE });
        }
        this.rows = hash.migconfigs;
      } catch (e) {}
    }
  },

  data() {
    return {
      rows:              [],
      schema:            null,
      hasAddonSchema:    false,
      hasPCIAddon:       false,
      hasSriovgpuAddon:  false,
      hasSRIOVGPUSchema: false,
      toVGpuAddon:       `${ HCI.ADD_ONS }/harvester-system/${ ADD_ONS.NVIDIA_DRIVER_TOOLKIT_CONTROLLER }?mode=edit`,
      toPciAddon:        `${ HCI.ADD_ONS }/harvester-system/${ ADD_ONS.PCI_DEVICE_CONTROLLER }?mode=edit`,
      SRIOVGPUPage:      `${ HCI.ADD_ONS }/harvester-system/${ ADD_ONS.NVIDIA_DRIVER_TOOLKIT_CONTROLLER }?mode=edit`,
    };
  },

  computed: {
    hasSchema() {
      return !!this.schema;
    },

    rowsData() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const rows = this.$store.getters[`${ inStore }/all`](HCI.MIG_CONFIGURATION) || [];

      return rows;
    },

    sriovGPUPage() {
      return {
        name:   'harvester-c-cluster-resource',
        params: { cluster: this.$store.getters['clusterId'], resource: HCI.SR_IOVGPU_DEVICE },
      };
    },

    showEnableSRIOVGPUMessage() {
      return this.rowsData.length === 0;
    },

    headers() {
      const cols = [
        STATE,
        NAME,
        {
          name:  'address',
          label: 'Address',
          value: 'spec.gpuAddress',
          sort:  ['spec.gpuAddress']
        },
        {
          name:     'Configured Profile',
          label:    'Configured Count',
          labelKey: 'harvester.tableHeaders.configuredProfile',
          value:    'configuredProfile',
          sort:     ['configuredProfile'],
          align:    'center'
        },
        {
          name:        'status',
          label:       'Status',
          labelKey:    'tableHeaders.status',
          sort:        ['status.status'],
          value:       'status.status',
        },
      ];

      return cols;
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else-if="!hasAddonSchema">
    <Banner color="warning">
      {{ t('harvester.vgpu.noPermission') }}
    </Banner>
  </div>
  <div v-else-if="!hasSriovgpuAddon || !hasPCIAddon">
    <Banner
      v-if="!hasSriovgpuAddon"
      color="warning"
    >
      <MessageLink
        :to="toVGpuAddon"
        prefix-label="harvester.vgpu.goSetting.prefix"
        middle-label="harvester.vgpu.goSetting.middle"
        suffix-label="harvester.vgpu.goSetting.suffix"
      />
    </Banner>
    <Banner
      v-if="!hasPCIAddon"
      color="warning"
    >
      <MessageLink
        :to="toPciAddon"
        prefix-label="harvester.pci.goSetting.prefix"
        middle-label="harvester.pci.goSetting.middle"
        suffix-label="harvester.pci.goSetting.suffix"
      />
    </Banner>
  </div>
  <div v-else-if="hasSchema">
    <Banner
      v-if="showEnableSRIOVGPUMessage"
      color="warning"
    >
      <MessageLink
        :to="sriovGPUPage"
        prefix-label="harvester.migconfiguration.goSriovGPU.prefix"
        middle-label="harvester.migconfiguration.goSriovGPU.middle"
        suffix-label="harvester.migconfiguration.goSriovGPU.suffix"
      />
    </Banner>
    <Banner
      v-if="!showEnableSRIOVGPUMessage"
      color="warning"
      :label="t('harvester.migconfiguration.infoBanner')"
    />
    <ResourceTable
      v-bind="$attrs"
      :groupable="false"
      :namespaced="false"
      :headers="headers"
      :schema="schema"
      :rows="rowsData"
      key-field="_key"
    />
  </div>
</template>
