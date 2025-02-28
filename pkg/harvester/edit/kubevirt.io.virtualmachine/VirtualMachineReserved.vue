<script>
import UnitInput from '@shell/components/form/UnitInput';

export default {
  name: 'HarvesterReserved',

  emits: ['updateReserved'],

  components: { UnitInput },

  props: {
    reservedMemory: {
      type:    String,
      default: null
    },
    mode: {
      type:    String,
      default: 'create',
    },
  },

  data() {
    return { memory: this.reservedMemory };
  },

  watch: {
    reservedMemory(memory) {
      this.memory = memory;
    },
  },

  methods: {
    change() {
      const { memory } = this;

      this.$emit('updateReserved', { memory });
    },
  }
};
</script>

<template>
  <UnitInput
    v-model:value="memory"
    :label="t('harvester.virtualMachine.input.reservedMemory')"
    :mode="mode"
    :input-exponent="2"
    :increment="1024"
    :output-modifier="true"
    suffix="Mi"
    @update:value="change"
  />
</template>
