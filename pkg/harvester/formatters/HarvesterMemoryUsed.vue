<script>
import PercentageBar from '@shell/components/PercentageBar';
import { METRIC, NODE } from '@shell/config/types';
import { formatSi, exponentNeeded, UNITS, parseSi } from '@shell/utils/units';
import { UNIT_SUFFIX } from '../utils/unit';
export default {
  name:       'HarvesterMemoryUsed',
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

    memoryTotal() {
      let out = 0;

      if (this.metrics) {
        out = this.metrics.memoryCapacity;
      }

      return out;
    },

    memoryUnits() {
      const exponent = exponentNeeded(this.memoryTotal, 1024);

      return `${ UNITS[exponent] }${ UNIT_SUFFIX }`;
    },

    node() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const node = this.$store.getters[`${ inStore }/byId`](NODE, this.row.id);

      return node;
    },

    reserved() {
      if (this.metrics) {
        return this.node.memoryReserved;
      } else {
        return 0;
      }
    },

    used() {
      if (this.metrics) {
        return parseSi(this.metrics?.usage?.memory || '0m', { increment: 1024 });
      } else {
        return 0;
      }
    },

    reservedPercentage() {
      return this.memoryTotal ? (this.reserved * 100) / this.memoryTotal : 0;
    },

    usedPercentage() {
      return this.memoryTotal ? (this.used * 100) / this.memoryTotal : 0;
    },

    reservedAmountTemplateValues() {
      return {
        used:  this.memoryFormatter(this.reserved || 0),
        total: this.memoryFormatter(this.memoryTotal || 0),
        unit:  ` ${ this.memoryUnits }`,
      };
    },

    usedAmountTemplateValues() {
      return {
        used:  this.memoryFormatter(this.used || 0),
        total: this.memoryFormatter(this.memoryTotal || 0),
        unit:  ` ${ this.memoryUnits }`,
      };
    },
  },

  methods: {
    memoryFormatter(value) {
      const exponent = exponentNeeded(this.memoryTotal, 1024);

      const formatOptions = {
        addSuffix:   false,
        increment:   1024,
        minExponent: exponent
      };

      return formatSi(value, formatOptions);
    },
  }
};
</script>

<template>
  <div>
    <div class="consumption-gauge">
      <div class="numbers">
        <span class="mr-10">
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
