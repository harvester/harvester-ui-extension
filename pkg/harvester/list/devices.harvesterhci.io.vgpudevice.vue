<script>
import { allHash } from '@shell/utils/promise';
import Banner from '@components/Banner/Banner.vue';
import Loading from '@shell/components/Loading';
import MessageLink from '@shell/components/MessageLink';
import { HCI } from '../types';
import VGpuDeviceList from '../edit/kubevirt.io.virtualmachine/VirtualMachineVGpuDevices/VGpuDeviceList';
import { ADD_ONS } from '../config/harvester-map';

export default {
  name: 'ListVGpuDevices',

  inheritAttrs: false,

  components: {
    Banner,
    Loading,
    MessageLink,
    VGpuDeviceList
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.schema = this.$store.getters[`${ inStore }/schemaFor`](HCI.VGPU_DEVICE);
    this.hasAddonSchema = this.$store.getters[`${ inStore }/schemaFor`](HCI.ADD_ONS);

    if (this.hasSchema) {
      try {
        const hash = await allHash({
          vGpuDevices: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VGPU_DEVICE }),
          addons:      this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.ADD_ONS }),
        });

        this.hasPCIAddon = hash.addons.find((addon) => addon.name === ADD_ONS.PCI_DEVICE_CONTROLLER)?.spec?.enabled === true;
        this.hasSriovgpuAddon = hash.addons.find((addon) => addon.name === ADD_ONS.NVIDIA_DRIVER_TOOLKIT_CONTROLLER)?.spec?.enabled === true;

        this.hasSRIOVGPUSchema = !!this.$store.getters[`${ inStore }/schemaFor`](HCI.SR_IOVGPU_DEVICE);
        if (this.hasSRIOVGPUSchema) {
          await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SR_IOVGPU_DEVICE });
        }
      } catch (e) {}
    }
  },

  data() {
    return {
      hasAddonSchema:    false,
      hasPCIAddon:       false,
      hasSriovgpuAddon:  false,
      hasSRIOVGPUSchema: false,
      schema:            null,
      toVGpuAddon:       `${ HCI.ADD_ONS }/harvester-system/${ ADD_ONS.NVIDIA_DRIVER_TOOLKIT_CONTROLLER }?mode=edit`,
      toPciAddon:        `${ HCI.ADD_ONS }/harvester-system/${ ADD_ONS.PCI_DEVICE_CONTROLLER }?mode=edit`
    };
  },

  computed: {
    hasSchema() {
      return !!this.schema;
    },

    rows() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vGpuDevices = this.$store.getters[`${ inStore }/all`](HCI.VGPU_DEVICE) || [];
      const srioVGpuDevices = this.$store.getters[`${ inStore }/all`](HCI.SR_IOVGPU_DEVICE) || [];

      vGpuDevices.forEach((row) => {
        row.allowDisable = true;
      });

      if (this.hasSRIOVGPUSchema) {
        return vGpuDevices.filter((device) => !!srioVGpuDevices.find((s) => s.isEnabled && s.spec?.nodeName === device.spec?.nodeName));
      }

      return vGpuDevices;
    }
  },

  typeDisplay() {
    return this.t('harvester.vgpu.label');
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
  <VGpuDeviceList
    v-else-if="hasSchema"
    :devices="rows"
    :schema="schema"
  />
</template>
