<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import InputOrDisplay from '@shell/components/InputOrDisplay';
import { VOLUME_TYPE, InterfaceOption } from '../../../../config/harvester-map';
import { Banner } from '@components/Banner';
import DiskPerformanceOptions from '../DiskPerformanceOptions';

export default {
  name: 'HarvesterEditContainer',

  emits: ['update'],

  components: {
    LabeledInput, LabeledSelect, InputOrDisplay, Banner, DiskPerformanceOptions
  },

  props: {
    mode: {
      type:    String,
      default: 'create'
    },

    value: {
      type:     Object,
      required: true
    },
  },

  data() {
    return {
      VOLUME_TYPE,
      InterfaceOption
    };
  },

  watch: {
    'value.type'(neu) {
      if (neu === 'cd-rom') {
        this.value['bus'] = 'sata';
        this.update();
      }
    },
  },

  methods: {
    update() {
      this.$emit('update');
    }
  }
};
</script>

<template>
  <div>
    <div class="row mb-20">
      <div
        data-testid="input-hec-name"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.name')"
          :value="value.name"
          :mode="mode"
        >
          <LabeledInput
            v-model:value="value.name"
            :label="t('harvester.fields.name')"
            required
            :mode="mode"
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
      <div
        data-testid="input-hec-type"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.type')"
          :value="value.type"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.type"
            :label="t('harvester.fields.type')"
            :options="VOLUME_TYPE"
            :mode="mode"
            required
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
    </div>

    <div class="row mb-20">
      <div
        data-testid="input-hec-container"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.virtualMachine.volume.dockerImage')"
          :value="value.container"
          :mode="mode"
        >
          <LabeledInput
            v-model:value="value.container"
            :label="t('harvester.virtualMachine.volume.dockerImage')"
            :mode="mode"
            required
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
      <div
        data-testid="input-hec-bus"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.virtualMachine.volume.bus')"
          :value="value.bus"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.bus"
            :label="t('harvester.virtualMachine.volume.bus')"
            :options="InterfaceOption"
            :mode="mode"
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
    </div>
    <div class="row mb-20">
      <div
        v-if="value.volumeBackups"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.virtualMachine.volume.readyToUse')"
          :value="value.volumeBackups.readyToUse"
          :mode="mode"
        >
          <LabelValue
            :name="t('harvester.virtualMachine.volume.readyToUse')"
            :value="value.volumeBackups.readyToUse"
          />
        </InputOrDisplay>
      </div>
    </div>
    <Banner
      v-if="value.volumeBackups && value.volumeBackups.error && value.volumeBackups.error.message"
      color="error"
      class="mb-20"
      :label="value.volumeBackups.error.message"
    />

    <DiskPerformanceOptions
      :value="value"
      :mode="mode"
      @update="update"
    />
  </div>
</template>
