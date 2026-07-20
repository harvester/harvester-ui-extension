<script>
import PercentageBar from '@shell/components/PercentageBar';
import { METRIC, NODE } from '@shell/config/types';
import { parseSi } from '@shell/utils/units';

export default {
  name:       'HarvesterCpuUsed',
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

    showUsed: {
      type:    Boolean,
      default: false,
    },
  },

  data() {
    return {};
  },

  computed: {
    metrics() {
      return this.$store.getters['harvester/byId'](METRIC.NODE, this.row.id);
    },

    cpuTotal() {
      let out = 0;

      if (this.metrics) {
        out = this.metrics.cpuCapacity;
      }

      return out;
    },

    cpuUnits() {
      return 'C';
    },

    node() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const node = this.$store.getters[`${ inStore }/byId`](NODE, this.row.id);

      return node;
    },

    reserved() {
      if (this.metrics) {
        return this.node.cpuReserved;
      } else {
        return 0;
      }
    },

    used() {
      if (this.metrics) {
        return parseSi(this.metrics?.usage?.cpu || '0m');
      } else {
        return 0;
      }
    },

    reservedPercentage() {
      return this.cpuTotal ? (this.reserved * 100) / this.cpuTotal : 0;
    },

    usedPercentage() {
      return this.cpuTotal ? (this.used * 100) / this.cpuTotal : 0;
    },

    reservedAmountTemplateValues() {
      return {
        used:  this.numberFormatter(this.reserved || 0),
        total: this.numberFormatter(this.cpuTotal || 0),
        unit:  ` ${ this.cpuUnits }`,
      };
    },

    usedAmountTemplateValues() {
      return {
        used:  this.numberFormatter(this.used || 0),
        total: this.numberFormatter(this.cpuTotal || 0),
        unit:  ` ${ this.cpuUnits }`,
      };
    },
  },

  methods: {
    numberFormatter(value) {
      return Number.isInteger(value) ? value : value.toFixed(2);
    },
  },
};
</script>

<template>
  <div>
    <div class="consumption-gauge">
      <div class="numbers">
        <span class="mr-5">
          {{ t('harvester.formatters.hardwareResourceGauge.reserved') }}
        </span>
        <span class="precent-data">
          {{ t('node.detail.glance.consumptionGauge.amount', reservedAmountTemplateValues) }}
        </span>
      </div>
      <div class="mt-10">
        <PercentageBar
          :model-value="reservedPercentage"
          show-percentage
        />
      </div>
    </div>
    <div
      v-if="showUsed"
      class="consumption-gauge mt-10"
    >
      <div class="numbers">
        <span>
          {{ t('harvester.formatters.hardwareResourceGauge.used') }}
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
