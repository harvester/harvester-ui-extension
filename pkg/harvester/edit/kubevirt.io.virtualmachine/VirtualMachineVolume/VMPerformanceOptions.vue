<script>
import InfoBox from '@shell/components/InfoBox';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import { _VIEW } from '@shell/config/query-params';
import { IO_THREADS_POLICY } from '../../../config/harvester-map';

export default {
  name: 'VMPerformanceOptions',

  components: {
    InfoBox, LabeledSelect, LabeledInput, Checkbox, Banner
  },

  emits: ['update:blockMultiQueue', 'update:ioThreadsPolicy', 'update:ioThreadCount'],

  props: {
    blockMultiQueue: {
      type:    Boolean,
      default: false
    },

    ioThreadsPolicy: {
      type:    String,
      default: ''
    },

    ioThreadCount: {
      type:    Number,
      default: 2
    },

    mode: {
      type:    String,
      default: 'create'
    },

    // Whether the current disk set contains a virtio disk (VM context only).
    hasVirtioDisk: {
      type:    Boolean,
      default: true
    },

    // Whether any disk requests a dedicated I/O thread (drives the auto-enable hint).
    hasDedicatedIothread: {
      type:    Boolean,
      default: false
    },
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    storagePerformanceEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('highPerformanceStorage');
    },

    ioThreadsPolicyOptions() {
      return IO_THREADS_POLICY.map((value) => ({
        label: value === '' ? this.t('harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.default') : this.t(`harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.${ value }`),
        value,
      }));
    },
  },

  watch: {
    // Block Multi-Queue only applies to virtio disks. If the last virtio disk is
    // removed while it is enabled, clear it so the VM is not left with an invalid
    // setting the disabled checkbox can no longer surface.
    hasVirtioDisk(neu) {
      if (!neu && this.blockMultiQueue) {
        this.$emit('update:blockMultiQueue', false);
      }
    },
  },
};
</script>

<template>
  <InfoBox
    v-if="storagePerformanceEnabled && (!isView || blockMultiQueue || !!ioThreadsPolicy)"
    class="vm-perf mt-10"
  >
    <h3 class="mb-5">
      {{ t('harvester.virtualMachine.volume.diskPerformance.title') }}
    </h3>
    <p class="text-muted mb-15">
      {{ t('harvester.virtualMachine.volume.diskPerformance.description') }}
    </p>

    <div class="row mb-10">
      <div
        class="col span-12"
        data-testid="input-vm-block-multi-queue"
      >
        <Checkbox
          :value="blockMultiQueue"
          :label="t('harvester.virtualMachine.volume.diskPerformance.blockMultiQueue.label')"
          :tooltip="t('harvester.virtualMachine.volume.diskPerformance.blockMultiQueue.tip')"
          :mode="mode"
          :disabled="!hasVirtioDisk"
          @update:value="$emit('update:blockMultiQueue', $event)"
        />
      </div>
    </div>
    <Banner
      v-if="!hasVirtioDisk && !isView"
      color="info"
      :label="t('harvester.virtualMachine.volume.diskPerformance.blockMultiQueue.noVirtioTip')"
    />

    <div class="row mb-10">
      <div
        class="col span-6"
        data-testid="input-vm-iothreads-policy"
      >
        <LabeledSelect
          :value="ioThreadsPolicy"
          :label="t('harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.label')"
          :tooltip="t('harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.tip')"
          :options="ioThreadsPolicyOptions"
          :mode="mode"
          @update:value="$emit('update:ioThreadsPolicy', $event)"
        />
      </div>
      <div
        v-if="ioThreadsPolicy === 'supplementalPool'"
        class="col span-6"
        data-testid="input-vm-iothread-count"
      >
        <LabeledInput
          type="number"
          min="1"
          :value="ioThreadCount"
          :label="t('harvester.virtualMachine.volume.diskPerformance.ioThreadCount.label')"
          :tooltip="t('harvester.virtualMachine.volume.diskPerformance.ioThreadCount.tip')"
          :mode="mode"
          @update:value="$emit('update:ioThreadCount', Number($event))"
        />
      </div>
    </div>
    <Banner
      v-if="hasDedicatedIothread && !ioThreadsPolicy"
      color="info"
      :label="t('harvester.virtualMachine.volume.diskPerformance.ioThreadsPolicy.autoEnabledTip')"
    />
  </InfoBox>
</template>
