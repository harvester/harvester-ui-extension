<script>
import Collapse from '@shell/components/Collapse';
import PercentageBar from '@shell/components/PercentageBar';
import { HCI } from '../types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';

export default {
  name:       'HarvesterUpgradeProgressList',
  components: { PercentageBar, Collapse },

  props: {
    title: {
      type:    String,
      default: ''
    },

    percent: {
      type:    Number,
      default: 0
    },

    list: {
      type:    Array,
      default: () => {
        return [];
      }
    }
  },

  async fetch() {
    await this.$store.dispatch('harvester/findAll', { type: HCI.UPGRADE });
  },

  data() {
    return { open: true };
  },

  computed: {
    showResumeButton() {
      return this.title === 'Upgrading Node';
    },
    latestUpgradeCR() {
      return this.$store.getters['harvester/all'](HCI.UPGRADE).find( (U) => U.isLatestUpgrade);
    },
    resumeUpgradePausedNodeEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('resumeUpgradePausedNode');
    },
  },
  methods: {
    handleSwitch() {
      this.open = !this.open;
    },
    async resumeNodeUpgrade(nodeName) {
      if (!this.latestUpgradeCR || !nodeName) return;

      try {
        const upgradePauseMapString = this.latestUpgradeCR.metadata.annotations[HCI_ANNOTATIONS.NODE_UPGRADE_PAUSE_MAP] || '{}';
        const upgradePauseMap = JSON.parse(upgradePauseMapString);

        // update the upgrade CR annotation harvesterhci.io/node-upgrade-pause-map to unpause the node upgrade process
        upgradePauseMap[`${ nodeName }`] = 'unpause';
        this.latestUpgradeCR.setAnnotation(HCI_ANNOTATIONS.NODE_UPGRADE_PAUSE_MAP, JSON.stringify(upgradePauseMap));
        await this.latestUpgradeCR.save();
      } catch (e) {
        console.error(`unable to update harvester upgrade CR annotations: ${ this.latestUpgradeCR.id }.`, e); // eslint-disable-line no-console

        return false;
      }
    }
  }
};
</script>

<template>
  <div class="bar-list">
    <h4>{{ title }} <span class="float-r text-info">{{ percent }}%</span></h4>
    <div>
      <div>
        <Collapse v-model:open="open">
          <template #title>
            <div class="total-bar">
              <span class="bar">
                <PercentageBar
                  :model-value="percent"
                  preferred-direction="MORE"
                />
              </span>
              <span
                class="on-off"
                @click="handleSwitch"
              > {{ open ? t('harvester.generic.close') : t('harvester.generic.open') }}</span>
            </div>
          </template>

          <div class="custom-content">
            <div
              v-for="(item, i) in list"
              :key="i"
            >
              <div class="upgrade-node-header">
                <div class="upgrade-node-title">
                  <p>
                    {{ item.name }}
                  </p>
                  <span
                    class="status"
                    :class="{ [item.state]: true }"
                  >
                    {{ item.state }}
                  </span>
                </div>
                <button
                  v-if="showResumeButton && resumeUpgradePausedNodeEnabled && item.state === 'Node-upgrade paused'"
                  type="button"
                  class="btn bg-info btn-sm"
                  data-testid="add-item"
                  @click="resumeNodeUpgrade(item.name)"
                >
                  {{ t('action.resume') }}
                </button>
              </div>
              <PercentageBar
                :model-value="item.percent"
                preferred-direction="MORE"
              />
              <p class="warning">
                {{ item.message }}
              </p>
            </div>
          </div>
        </Collapse>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bar-list {
  .float-r {
    float: right;
  }

  .total-bar {
    display: flex;
    user-select: none;
    > .bar {
      width: 85%;
    }
    .on-off {
      margin-left: 10px;
      cursor: pointer;
    }
  }
  .custom-content {
    .upgrade-node-title {
      flex: 1 0 80%;
      margin-right: 10px;
      display: flex;
      justify-content: space-between;
    }
    .upgrade-node-header {
      display:flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    margin-bottom: 14px;

    .status {
      float: right;
    }
    .Succeeded, .Upgrading, .Pending {
      color: var(--success);
    }
    .failed {
      color: var(--error)
    }
    .warning {
      color: var(--error);
      margin-bottom: 8px;
      margin-top: 4px;
    }
  }
}
</style>
