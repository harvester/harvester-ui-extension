<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RadioGroup } from '@components/Form/Radio';
import { mapGetters } from 'vuex';

export default {
  name: 'HarvesterUpgradeConfig',

  components: {
    LabeledInput,
    LabeledSelect,
    RadioGroup
  },
  mixins: [CreateEditView],

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
    }
  },

  created() {
    this.update();
  },

  methods: {
    normalizeValue(obj) {
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
    }
  }
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
