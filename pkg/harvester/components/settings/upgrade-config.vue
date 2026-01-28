<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RadioGroup } from '@components/Form/Radio';
import { mapGetters } from 'vuex';
import { allHash } from '@shell/utils/promise';
import { NODE } from '@shell/config/types';

export default {
  name: 'HarvesterUpgradeConfig',

  components: {
    LabeledInput,
    LabeledSelect,
    RadioGroup
  },
  mixins: [CreateEditView],

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const hash = { nodes: this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }) };

    await allHash(hash);
  },

  data() {
    let parseDefaultValue = {};

    try {
      parseDefaultValue = this.value.value ? JSON.parse(this.value.value) : JSON.parse(this.value.default);
    } catch (error) {
      parseDefaultValue = JSON.parse(this.value.default);
    }
    parseDefaultValue = this.normalizeValue(parseDefaultValue);

    return {
      parseDefaultValue,
      errors: []
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),
    strategyOptions() {
      return [
        { value: 'sequential', label: 'sequential' },
        { value: 'skip', label: 'skip' },
        { value: 'parallel', label: 'parallel' }
      ];
    },
    nodeUpgradeOptions() {
      return [
        { value: 'auto', label: 'auto' },
        { value: 'manual', label: 'manual' }
      ];
    },
    nodesOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const nodes = this.$store.getters[`${ inStore }/all`](NODE);

      return nodes.map((node) => ({ value: node.id, label: node.name }));
    },
    showPauseNodes() {
      return this.parseDefaultValue.nodeUpgradeOption?.strategy?.mode === 'manual';
    }
  },

  created() {
    this.update();
  },

  methods: {
    normalizeValue(obj) {
      // handle nodeUpgradeOption.strategy
      if (obj?.nodeUpgradeOption?.strategy?.mode === 'auto') {
        delete obj.nodeUpgradeOption.strategy.pauseNodes;
      }

      if (obj?.nodeUpgradeOption?.strategy?.mode === 'manual') {
        if (!Array.isArray(obj.nodeUpgradeOption.strategy.pauseNodes)) {
          obj.nodeUpgradeOption.strategy.pauseNodes = this.nodesOptions.map((node) => node.value);
        }
      }

      // handle imagePreloadOption.strategy
      if (!obj.imagePreloadOption) {
        obj.imagePreloadOption = { strategy: { type: 'sequential' } };
      }
      if (!obj.imagePreloadOption.strategy) {
        obj.imagePreloadOption.strategy = { type: 'sequential' };
      }
      if (!obj.imagePreloadOption.strategy.type) {
        obj.imagePreloadOption.strategy.type = 'sequential';
      }
      // Only set concurrency if type is 'parallel'
      if (obj.imagePreloadOption.strategy.type === 'parallel') {
        if (typeof obj.imagePreloadOption.strategy.concurrency !== 'number') {
          obj.imagePreloadOption.strategy.concurrency = 0;
        }
      } else {
        delete obj.imagePreloadOption.strategy.concurrency;
      }
      if (typeof obj.restoreVM !== 'boolean') {
        obj.restoreVM = false;
      }

      return obj;
    },
    update() {
      try {
        // Clone to avoid mutating the form state
        const valueToSave = JSON.parse(JSON.stringify(this.parseDefaultValue));

        if (valueToSave.imagePreloadOption && valueToSave.imagePreloadOption.strategy) {
          if (valueToSave.imagePreloadOption.strategy.type !== 'parallel') {
            delete valueToSave.imagePreloadOption.strategy.concurrency;
          }
        }

        this.value['value'] = JSON.stringify(valueToSave, null, 2);
        this.errors = [];
      } catch (e) {
        this.errors = ['Invalid JSON'];
      }
    }
  },

  watch: {
    value: {
      handler(neu) {
        let parseDefaultValue;

        try {
          parseDefaultValue = JSON.parse(neu.value);
        } catch (err) {
          parseDefaultValue = JSON.parse(this.value.default);
        }
        parseDefaultValue = this.normalizeValue(parseDefaultValue);
        this['parseDefaultValue'] = parseDefaultValue;
        this.update();
      },
      deep: true
    },
  },
};
</script>

<template>
  <div>
    <div
      class="row"
      @input="update"
    >
      <div class="col span-12">
        <label class="mb-5"><b>{{ t('harvester.setting.upgrade.imagePreloadStrategy') }}</b></label>
        <LabeledSelect
          v-model:value="parseDefaultValue.imagePreloadOption.strategy.type"
          class="mb-20"
          :mode="mode"
          :label="t('harvester.setting.upgrade.strategyType')"
          :options="strategyOptions"
          @update:value="update"
        />
        <LabeledInput
          v-if="parseDefaultValue.imagePreloadOption.strategy.type === 'parallel'"
          v-model:value.number="parseDefaultValue.imagePreloadOption.strategy.concurrency"
          class="mb-20"
          :mode="mode"
          :label="t('harvester.setting.upgrade.concurrency')"
          min="0"
          type="number"
        />
        <label class="mb-5"><b>{{ t('harvester.setting.upgrade.restoreVM') }}</b></label>
        <RadioGroup
          v-model:value="parseDefaultValue.restoreVM"
          class="mb-20"
          name="restoreVM"
          :options="[true, false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
          @update:value="update"
        />
        <label class="mb-5"><b>{{ t('harvester.setting.upgrade.nodeUpgradeOption') }}</b></label>
        <LabeledSelect
          v-model:value="parseDefaultValue.nodeUpgradeOption.strategy.mode"
          class="mb-20 label-select"
          :mode="mode"
          :label="t('harvester.setting.upgrade.strategy')"
          :options="nodeUpgradeOptions"
          @update:value="update"
        />
        <LabeledSelect
          v-if="showPauseNodes"
          v-model:value="parseDefaultValue.nodeUpgradeOption.strategy.pauseNodes"
          class="mb-20 label-select"
          :clearable="true"
          :multiple="true"
          :mode="mode"
          :label="t('harvester.setting.upgrade.pauseNodes')"
          :options="nodesOptions"
          @update:value="update"
        />
        <div
          v-if="errors.length"
          class="error"
        >
          {{ errors[0] }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error {
  color: #d9534f;
  margin-top: 5px;
}
</style>
