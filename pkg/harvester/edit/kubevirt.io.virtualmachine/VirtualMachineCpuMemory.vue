<script>
import UnitInput from '@shell/components/form/UnitInput';
import InputOrDisplay from '@shell/components/InputOrDisplay';
import { GIBIBYTE } from '../../utils/unit';
import { Checkbox } from '@components/Form/Checkbox';
import { _VIEW } from '@shell/config/query-params';

const HOT_PLUG_TIMES = 4;

export default {
  name: 'HarvesterEditCpuMemory',

  emits: ['updateCpuMemory'],

  components: {
    UnitInput, InputOrDisplay, Checkbox
  },

  props: {
    cpu: {
      type:    Number,
      default: null
    },
    maxCpu: {
      type:    Number,
      default: null
    },
    memory: {
      type:    String,
      default: null
    },
    maxMemory: {
      type:    String,
      default: null
    },
    enableHotPlug: {
      type:    Boolean,
      default: false
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
      GIBIBYTE,
      localCpu:           this.cpu,
      localMemory:        this.memory,
      maxLocalCpu:        this.maxCpu,
      maxLocalMemory:     this.maxMemory,
      localEnableHotPlug: this.enableHotPlug
    };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },
    cpuDisplay() {
      return `${ this.localCpu } C`;
    },

    maxCpuDisplay() {
      return `${ this.maxLocalCpu } C`;
    },

    memoryDisplay() {
      return `${ this.localMemory }`;
    },

    maxMemoryDisplay() {
      return `${ this.maxLocalMemory }`;
    },

    cpuMemoryHotplugTooltip() {
      return this.t('harvester.virtualMachine.hotplug.tooltip', { hotPlugTimes: HOT_PLUG_TIMES });
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
    },
    maxCpu(neu) {
      this.maxLocalCpu = neu;
    },
    maxMemory(neu) {
      if (neu && !neu.includes('null')) {
        this.maxLocalMemory = neu;
      }
    },
    enableHotPlug(neu) {
      this.localEnableHotPlug = neu;
    }
  },

  methods: {
    hotPlugChanged(neu) {
      // If hot plug is enabled, we need to update the maxCpu and maxMemory values
      if (neu) {
        this.maxLocalCpu = this.localCpu ? this.localCpu * HOT_PLUG_TIMES : null;
        this.maxLocalMemory = this.localMemory ? `${ parseInt(this.localMemory, 10) * HOT_PLUG_TIMES }${ GIBIBYTE }` : null;
        this.$emit('updateCpuMemory', this.localCpu, this.localMemory, this.maxLocalCpu, this.maxLocalMemory, neu);
      } else {
        this.$emit('updateCpuMemory', this.localCpu, this.localMemory, '', null, neu);
      }
    },
    changeMemory() {
      if (this.localEnableHotPlug) {
        this.maxLocalMemory = this.localMemory ? `${ parseInt(this.localMemory, 10) * HOT_PLUG_TIMES }${ GIBIBYTE }` : null;
      }
      this.$emit('updateCpuMemory', this.localCpu, this.localMemory, this.maxLocalCpu, this.maxLocalMemory, this.localEnableHotPlug);
    },
    changeCPU() {
      if (this.localEnableHotPlug) {
        this.maxLocalCpu = this.localCpu ? this.localCpu * HOT_PLUG_TIMES : null;
      }
      this.$emit('updateCpuMemory', this.localCpu, this.localMemory, this.maxLocalCpu, this.maxLocalMemory, this.localEnableHotPlug);
    },
    changeMaxCPUMemory() {
      this.$emit('updateCpuMemory', this.localCpu, this.localMemory, this.maxLocalCpu, this.maxLocalMemory, this.localEnableHotPlug);
    },
  }
};
</script>

<template>
  <div>
    <div class="row">
      <div class="col span-6 mb-10">
        <InputOrDisplay
          name="CPU"
          :value="cpuDisplay"
          :mode="mode"
          class="mb-10"
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
            @update:value="changeCPU"
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
            :suffix="GIBIBYTE"
            class="mb-20"
            @update:value="changeMemory"
          />
        </InputOrDisplay>
      </div>
    </div>
    <div class="row">
      <Checkbox
        v-model:value="localEnableHotPlug"
        class="check"
        type="checkbox"
        :label="t('harvester.virtualMachine.hotplug.title')"
        :disabled="isView"
        @update:value="hotPlugChanged"
      />
      <i
        v-clean-tooltip="{content: cpuMemoryHotplugTooltip, triggers: ['hover', 'touch', 'focus'] }"
        v-stripped-aria-label="cpuMemoryHotplugTooltip"
        class="icon icon-info"
        tabindex="0"
      />
    </div>
    <div
      v-if="localEnableHotPlug"
      class="row"
    >
      <div class="col span-6 mb-10">
        <InputOrDisplay
          :name="t('harvester.virtualMachine.input.maxCpu')"
          :value="maxCpuDisplay"
          :mode="mode"
          class="mt-20"
        >
          <UnitInput
            v-model:value="maxLocalCpu"
            :label="t('harvester.virtualMachine.input.maxCpu')"
            suffix="C"
            :delay="0"
            :disabled="disabled"
            :mode="mode"
            class="mt-20"
            @update:value="changeMaxCPUMemory"
          />
        </InputOrDisplay>
      </div>
      <div class="col span-6 mb-10">
        <InputOrDisplay
          :name="t('harvester.virtualMachine.input.maxMemory')"
          :value="maxMemoryDisplay"
          :mode="mode"
          class="mt-20"
        >
          <UnitInput
            v-model:value="maxLocalMemory"
            :label="t('harvester.virtualMachine.input.maxMemory')"
            :mode="mode"
            :input-exponent="3"
            :delay="0"
            :increment="1024"
            :output-modifier="true"
            :disabled="disabled"
            :suffix="GIBIBYTE"
            class="mt-20"
            @update:value="changeMaxCPUMemory"
          />
        </InputOrDisplay>
      </div>
    </div>
  </div>
</template>
