<script>
import { BadgeState } from '@components/BadgeState';
import { HCI } from '../types';

export default {
  emits: ['state-changed'],

  components: { BadgeState },

  props: {
    vmResource: {
      type:     Object,
      required: true
    },
    showSuccess: {
      type:    Boolean,
      default: true
    }
  },

  computed: {
    vmiResource() {
      const vmiList = this.$store.getters['harvester/all'](HCI.VMI) || [];
      const vmi = vmiList.find( (VMI) => {
        return VMI?.metadata?.ownerReferences?.[0]?.uid === this.vmResource?.metadata?.uid;
      });

      return vmi;
    },
    migrationState() {
      return this.vmiResource?.migrationState?.status || '';
    },
    migrationBackground() {
      return this.vmiResource?.migrationStateBackground || '';
    }
  },

  watch: {
    migrationState(neu) {
      this.$emit('state-changed', neu);
    }
  },
};
</script>

<template>
  <div v-if="migrationState">
    <span v-if="!showSuccess">/</span>
    <BadgeState
      :label="migrationState"
      :color="migrationBackground"
    />
  </div>
</template>

<style lang="scss" scoped>
  .badge-state {
    padding: 5px 10px;
    border: 1px solid transparent;
    border-radius: 20px;

    &.bg-info {
      border-color: var(--primary);
    }

    &.bg-error {
      border-color: var(--error);
    }

    &.bg-warning {
      border-color: var(--warning);
    }

    // Successful states are de-emphasized by using [text-]color instead of background-color
    &.bg-success {
      color: var(--success);
      border-color: var(--success);
      background: transparent;
    }
  }

  .sortable-table TD .badge-state {
    @include clip;
    display: inline-block;
    max-width: 100%;
    position: relative;
    padding: 2px 10px 1px 10px;
    font-size: 1em;
    max-width: 200px;
    font-size: .85em;
    vertical-align: middle;
  }
</style>
