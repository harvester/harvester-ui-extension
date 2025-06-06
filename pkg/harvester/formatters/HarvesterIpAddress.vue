<script>
import { get } from '@shell/utils/object';
import { isIpv4 } from '@shell/utils/string';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import CopyToClipboardText from '@shell/components/CopyToClipboardText';
import { HCI } from '../types';
import { MANAGEMENT_NETWORK } from '../mixins/harvester-vm';
import { OFF } from '../models/kubevirt.io.virtualmachine';

export default {
  components: { CopyToClipboardText },
  props:      {
    value: {
      type:    String,
      default: ''
    },
    row: {
      type:     Object,
      required: true
    },
    col: {
      type:    Object,
      default: () => {}
    }
  },

  data() {
    return { inStore: 'harvester' };
  },

  created() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.inStore = inStore;
  },

  computed: {
    ips() {
      if (this.vmiIp.length) {
        return [...this.vmiIp, ...this.networkAnnotationIP]
          .filter(Boolean)
          .sort((a, b) => a.ip < b.ip ? -1 : 1);
      }

      return this.customAnnotationIP;
    },

    customAnnotationIP() {
      const annotationIp = get(this.row, `metadata.annotations."${ HCI_ANNOTATIONS.CUSTOM_IP }"`);

      if (annotationIp && isIpv4(annotationIp)) {
        return [{
          name: 'custom-ip', ip: annotationIp, isCustom: true
        }];
      }

      return [];
    },

    networkAnnotationIP() {
      if (this.row.actualState !== 'Running') { // TODO: Running
        return [];
      }

      const annotationIp = get(this.row, `metadata.annotations."${ HCI_ANNOTATIONS.NETWORK_IPS }"`) || '[]';

      // Obtain IP from VM annotation, remove the CIDR suffix number if CIDR Exist
      try {
        const out = JSON.parse(annotationIp);

        return out.map( (ip) => ({
          ip:   ip.replace(/\/[\d\D]*/, ''),
          name: ''
        }));
      } catch (e) {
        return [];
      }
    },

    vmiIp() {
      const vmiResources = this.$store.getters[`${ this.inStore }/all`](HCI.VMI);
      const resource = vmiResources.find((VMI) => VMI.id === this.value) || null;
      const networksName = this.row.networksName || [];
      const vmiNetworks = resource?.spec?.networks || [];

      return (resource?.status?.interfaces || []).filter((intf) => {
        return isIpv4(intf.ipAddress) && networksName.includes(intf.name);
      }).map((intf) => {
        let name;
        const network = vmiNetworks.find((network) => network.name === intf.name);

        if (network && network.multus) {
          name = network.multus.networkName;
        } else if (network && network.pod) {
          name = MANAGEMENT_NETWORK;
        }

        return {
          ip: intf.ipAddress,
          name
        };
      });
    },

    showIP() {
      return this.row.stateDisplay !== OFF;
    },
  },
};
</script>

<template>
  <div v-if="showIP">
    <span
      v-for="{ ip, name, isCustom } in ips"
      :key="`${ip}-${name}`"
    >
      <CopyToClipboardText
        v-clean-tooltip="isCustom ? t('harvester.formatters.harvesterIpAddress.customIpTooltip') : name"
        :text="ip"
        :plain="isCustom"
      />
    </span>
  </div>
</template>
