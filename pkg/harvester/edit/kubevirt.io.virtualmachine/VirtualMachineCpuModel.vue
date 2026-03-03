<script>
import YAML from 'yaml';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { CONFIG_MAP } from '@shell/config/types';
import { Banner } from '@components/Banner';

const CPU_MODEL_CONFIG_MAP_ID = 'harvester-system/node-cpu-model-configuration';

export default {
  name: 'HarvesterCpuModel',

  emits: ['update:value'],

  components: {
    LabeledSelect,
    Banner
  },

  props: {
    value: {
      type:    String,
      default: ''
    },
    mode: {
      type:    String,
      default: 'create',
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    try {
      await this.$store.dispatch(`${ inStore }/find`, { type: CONFIG_MAP, id: CPU_MODEL_CONFIG_MAP_ID });
      this.fetchError = null;
    } catch (e) {
      this.fetchError = this.t('harvester.virtualMachine.cpuModel.fetchError', { error: e.message || e });
    }
  },

  data() {
    return { fetchError: null };
  },

  computed: {
    localValue: {
      get() {
        return this.value ?? '';
      },
      set(val) {
        this.$emit('update:value', val ?? '');
      }
    },

    cpuModelConfigMap() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/byId`](
        CONFIG_MAP,
        CPU_MODEL_CONFIG_MAP_ID
      );
    },

    cpuModelOptions() {
      if (!this.cpuModelConfigMap?.data?.cpuModels) {
        return [{ label: this.t('generic.default'), value: '' }];
      }

      let cpuModelsData;

      try {
        cpuModelsData = YAML.parse(this.cpuModelConfigMap.data?.cpuModels || '');
      } catch (e) {
        return [{ label: this.t('generic.default'), value: '' }];
      }

      const options = [];

      options.push({
        label: this.t('generic.default'),
        value: ''
      });

      // Add global models (host-model, host-passthrough)
      const globalModels = cpuModelsData.globalModels || [];

      globalModels.forEach((modelName) => {
        options.push({
          label: modelName,
          value: modelName
        });
      });

      // Add regular models with node count
      const modelEntries = Object.entries(cpuModelsData.models || {});

      // Sort models alphabetically for consistent display
      modelEntries.sort((a, b) => a[0].localeCompare(b[0]));

      modelEntries.forEach(([modelName, modelInfo]) => {
        const readyCount = modelInfo.readyCount || 0;
        const label = this.t('harvester.virtualMachine.cpuModel.optionLabel', { modelName, count: readyCount });

        options.push({
          label,
          value: modelName
        });
      });

      return options;
    },
  },
};
</script>

<template>
  <div>
    <Banner
      v-if="fetchError"
      color="error"
      class="mb-20"
    >
      {{ fetchError }}
    </Banner>
    <LabeledSelect
      v-model:value="localValue"
      :label="t('harvester.virtualMachine.cpuModel.label')"
      :options="cpuModelOptions"
      :mode="mode"
      :disabled="!!fetchError"
    />
  </div>
</template>
