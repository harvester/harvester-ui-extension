<script>
import UnitInput from '@shell/components/form/UnitInput';
import InputOrDisplay from '@shell/components/InputOrDisplay';

export default {
  name: 'HarvesterEditCpuMemory',

  emits: ['updateCpuMemory'],

  components: { UnitInput, InputOrDisplay },

  props: {
    cpu: {
      type:    Number,
      default: null
    },
    memory: {
      type:    String,
      default: null
    },
    mode: {
      type:    String,
      default: 'create',
    },
    disabled: {
      type:    Boolean,
      default: false
    }
  },

  data() {
    return {
      localCpu:    this.cpu,
      localMemory: this.memory
    };
  },

  computed: {
    cupDisplay() {
      return `${ this.localCpu } C`;
    },

    memoryDisplay() {
      return `${ this.localMemory }`;
    }
  },

  watch: {
    cpu(neu) {
      this.localCpu = neu;
    },
    memory(neu) {
      if (neu && !neu.includes('null')) {
        this.localMemory = neu;
      }
    }
  },

  methods: {
    change() {
      let memory = '';

      if (String(this.localMemory).includes('Gi')) {
        memory = this.localMemory;
      } else {
        memory = `${ this.localMemory }Gi`;
      }
      if (memory.includes('null')) {
        memory = null;
      }
      this.$emit('updateCpuMemory', this.localCpu, memory);
    },

  }
};
</script>

<template>
  <div class="row">
    <div class="col span-6 mb-10">
      <InputOrDisplay
        name="CPU"
        :value="cupDisplay"
        :mode="mode"
      >
        <UnitInput
          v-model:value="localCpu"
          label="CPU"
          suffix="C"
          :delay="0"
          required
          :disabled="disabled"
          :mode="mode"
          class="mb-20"
          @update:value="change"
        />
      </InputOrDisplay>
    </div>

    <div class="col span-6 mb-10">
      <InputOrDisplay
        :name="t('harvester.virtualMachine.input.memory')"
        :value="memoryDisplay"
        :mode="mode"
      >
        <UnitInput
          v-model:value="localMemory"
          :label="t('harvester.virtualMachine.input.memory')"
          :mode="mode"
          :input-exponent="3"
          :delay="0"
          :increment="1024"
          :output-modifier="true"
          :disabled="disabled"
          required
          suffix="Gi"
          class="mb-20"
          @update:value="change"
        />
      </InputOrDisplay>
    </div>
  </div>
</template>
