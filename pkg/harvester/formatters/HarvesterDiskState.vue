<script>
import { BadgeState } from '@components/BadgeState';
import { stateDisplay } from '@shell/plugins/dashboard-store/resource-class';

const ACTIVE = 'healthy';
const WARNING = 'warning';

export default {
  components: { BadgeState },
  props:      {
    value: {
      type:    String,
      default: ''
    },
    row: {
      type:     Object,
      required: true
    },
  },

  computed: {
    diskState() {
      const longhornDisks = this.row?.longhornDisks || [];
      const out = longhornDisks.reduce((state, disk) => {
        if (disk?.readyCondition?.status !== 'True' || disk?.schedulableCondition?.status !== 'True') {
          state = WARNING;
        }

        return state;
      }, ACTIVE);

      return out;
    },

    stateDisplay() {
      return stateDisplay(this.diskState);
    },

    stateBackground() {
      if ( this.diskState === ACTIVE ) {
        return 'bg-success';
      } else {
        return 'bg-warning';
      }
    },

    errorMessage() {
      if (this.diskState !== ACTIVE) {
        return this.t('harvester.host.disk.error');
      }

      return '';
    },

    warningMessage() {
      const blockDevices = this.row?.unProvisionedDisks || [];

      const out = [];

      blockDevices.map((b) => {
        if (b?.metadata?.state?.error) {
          out.push(b.metadata.state.message);
        }
      });

      return out;
    },
  },
};
</script>

<template>
  <div class="state">
    <BadgeState
      v-clean-tooltip="errorMessage"
      :color="stateBackground"
      :label="stateDisplay"
    />
    <v-dropdown
      v-if="warningMessage.length"
      trigger="hover"
      offset="16"
    >
      <span class="tooltip-target ml-5">
        <i class="icon icon-warning icon-lg text-warning" />
      </span>

      <template #popper>
        <p
          v-for="(message, index) in warningMessage"
          :key="index"
        >
          {{ index + 1 }}. {{ message }}
        </p>
      </template>
    </v-dropdown>
  </div>
</template>

<style lang="scss" scoped>
.state {
  display: flex;
  justify-content: left;

  .icon-warning {
    margin-top: 2px;
  }
}
</style>
