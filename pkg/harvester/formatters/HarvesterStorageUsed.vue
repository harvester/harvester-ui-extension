<script>
import PercentageBar from '@shell/components/PercentageBar';
import { LONGHORN } from '@shell/config/types';
import { formatSi, exponentNeeded, UNITS } from '@shell/utils/units';
import { UNIT_SUFFIX } from '../utils/unit';

export default {
  name:       'HarvesterStorageUsed',
  components: { PercentageBar },

  props: {
    value: {
      type:    String,
      default: ''
    },

    row: {
      type:     Object,
      required: true
    },

    resourceName: {
      type:    String,
      default: ''
    },

    showAllocated: {
      type:    Boolean,
      default: false,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.longhornSettings = await this.$store.dispatch(`${ inStore }/findAll`, { type: LONGHORN.SETTINGS });
  },

  data() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const longhornSettings = this.$store.getters[`${ inStore }/all`](LONGHORN.SETTINGS) || [];

    return { longhornSettings };
  },

  computed: {
    storageStats() {
      const stats = {
        used:      0,
        scheduled: 0,
        maximum:   0,
        reserved:  0,
        total:     0
      };
      const inStore = this.$store.getters['currentProduct'].inStore;
      const node = this.$store.getters[`${ inStore }/byId`](LONGHORN.NODES, `longhorn-system/${ this.row.id }`) || {};
      const storageOverProvisioningPercentageSetting = this.longhornSettings.find((s) => s.id === 'longhorn-system/storage-over-provisioning-percentage');
      const disks = node?.spec?.disks || {};
      const diskStatus = node?.status?.diskStatus || {};

      stats.used += node?.spec?.allowScheduling ? node.used : 0;

      Object.keys(disks).map((key) => {
        stats.scheduled += node?.spec?.allowScheduling ? (diskStatus[key]?.storageScheduled || 0) : 0;
        stats.reserved += disks[key]?.storageReserved || 0;
      });
      Object.values(diskStatus).map((diskStat) => {
        stats.maximum += diskStat?.storageMaximum || 0;
      });

      stats.total = ((stats.maximum - stats.reserved) * Number(storageOverProvisioningPercentageSetting?.value ?? 0)) / 100;

      return stats;
    },

    allocatedUnits() {
      const exponent = exponentNeeded(this.storageStats.total, 1024);

      return `${ UNITS[exponent] }${ UNIT_SUFFIX }`;
    },

    usedUnits() {
      const exponent = exponentNeeded(this.storageStats.maximum, 1024);

      return `${ UNITS[exponent] }${ UNIT_SUFFIX }`;
    },

    formatUsed() {
      let out = this.formatter(this.storageStats.used);

      if (!Number.parseFloat(out) > 0) {
        out = this.formatter(this.storageStats.used, { canRoundToZero: true });
      }

      return out;
    },

    formatAllocated() {
      let out = this.formatter(this.storageStats.scheduled);

      if (!Number.parseFloat(out) > 0) {
        out = this.formatter(this.storageStats.scheduled, { canRoundToZero: true });
      }

      return out;
    },

    usedAmountTemplateValues() {
      return {
        used:  this.formatUsed,
        total: this.formatter(this.storageStats.maximum),
        unit:  this.usedUnits,
      };
    },

    allocatedAmountTemplateValues() {
      return {
        used:  this.formatAllocated,
        total: this.formatter(this.storageStats.total),
        unit:  this.allocatedUnits,
      };
    },

    usedPercentage() {
      return this.storageStats.maximum ? (this.storageStats.used * 100) / this.storageStats.maximum : 0;
    },

    allocatedPercentage() {
      return this.storageStats.total ? (this.storageStats.scheduled * 100) / this.storageStats.total : 0;
    },
  },

  methods: {
    formatter(value, format) {
      const minExponent = exponentNeeded(this.storageStats.maximum, 1024);
      const formatOptions = {
        addSuffix: false,
        increment: 1024,
        minExponent,
      };

      return formatSi(value, {
        ...formatOptions,
        ...format,
      });
    },
  }
};
</script>

<template>
  <div>
    <div
      v-if="showAllocated"
      class="consumption-gauge"
    >
      <div class="numbers">
        <span class="mr-10">
          {{ t('harvester.dashboard.hardwareResourceGauge.allocated') }}
        </span>
        <span class="precent-data">
          {{ t('node.detail.glance.consumptionGauge.amount', allocatedAmountTemplateValues) }}
        </span>
      </div>
      <div class="mt-10">
        <PercentageBar
          :model-value="allocatedPercentage"
          show-percentage
        />
      </div>
    </div>
    <div
      class="consumption-gauge"
      :class="{ 'mt-10': showAllocated }"
    >
      <div class="numbers">
        <span>
          {{ t('node.detail.glance.consumptionGauge.used') }}
        </span>
        <span class="precent-data">
          {{ t('node.detail.glance.consumptionGauge.amount', usedAmountTemplateValues) }}
        </span>
      </div>
      <div class="mt-10">
        <PercentageBar
          :model-value="usedPercentage"
          show-percentage
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.consumption-gauge {
  .numbers {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
}

.precent-data {
  white-space: nowrap;
}
</style>
