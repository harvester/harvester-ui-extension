<script>
import YAML from 'yaml';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { CONFIG_MAP } from '@shell/config/types';
import { Banner } from '@components/Banner';

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
      await this.$store.dispatch(`${ inStore }/findAll`, { type: CONFIG_MAP });
      this.cpuModelConfigMap = this.$store.getters[`${ inStore }/byId`](CONFIG_MAP, 'harvester-system/node-cpu-model-configuration');
      this.fetchError = null;

      // Force re-render of LabeledSelect after options are ready
      await this.$nextTick();
      this.componentKey += 1;
    } catch (e) {
      this.fetchError = this.t('harvester.virtualMachine.cpuModel.fetchError', { error: e.message || e }, true);
    }
  },

  data() {
    return {
      cpuModelConfigMap: null,
      fetchError:        null,
      componentKey:      0,
    };
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

    cpuModelOptions() {
      if (!this.cpuModelConfigMap) {
        return [];
      }

      const cpuModelsData = YAML.parse(this.cpuModelConfigMap.data?.cpuModels || '');
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
        const nodeLabel = readyCount === 1 ? 'node' : 'nodes';
        const label = `${ modelName } (${ readyCount } ${ nodeLabel })`;

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
      :key="componentKey"
      v-model:value="localValue"
      :label="t('harvester.virtualMachine.cpuModel.label')"
      :options="cpuModelOptions"
      :mode="mode"
      :disabled="!!fetchError"
    />
  </div>
</template>
