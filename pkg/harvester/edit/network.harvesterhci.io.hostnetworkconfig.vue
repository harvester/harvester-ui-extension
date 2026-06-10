<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import InfoBox from '@shell/components/InfoBox';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { Checkbox } from '@components/Form/Checkbox';
import HarvesterNodeSelector from '../components/HarvesterNodeSelector';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { set } from '@shell/utils/object';
import { NODE } from '@shell/config/types';
import { HCI } from '../types';

const MODE_DHCP = 'dhcp';
const MODE_STATIC = 'static';

export default {
  name: 'HarvesterHostNetworkConfigEditPage',

  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    ResourceTabs,
    Tab,
    InfoBox,
    LabeledSelect,
    LabeledInput,
    RadioGroup,
    Checkbox,
    HarvesterNodeSelector,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      clusterNetworks: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.CLUSTER_NETWORK }),
      nodes:           this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
    });
  },

  data() {
    const networkMode = this.value?.spec?.mode || MODE_DHCP;
    const ips = { ...(this.value?.spec?.ips || {}) };

    if (!this.value.spec) {
      set(this.value, 'spec', {});
    }

    return {
      networkMode,
      ips,
      NODE,
      hasNodeSelector: !!this.value?.spec?.nodeSelector,
    };
  },

  computed: {
    modeOptions() {
      return [
        { label: 'DHCP', value: MODE_DHCP },
        { label: 'Static', value: MODE_STATIC },
      ];
    },

    clusterNetworkOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const clusterNetworks = this.$store.getters[`${ inStore }/all`](HCI.CLUSTER_NETWORK) || [];

      return clusterNetworks.map((n) => {
        const disabled = !n.isReady;

        return {
          label: disabled ? `${ n.id } (${ this.t('generic.notReady') })` : n.id,
          value: n.id,
          disabled,
        };
      });
    },

    nodes() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](NODE) || [];
    },

    isStaticMode() {
      return this.networkMode === MODE_STATIC;
    },

    underlay: {
      get() {
        return !!this.value?.spec?.underlay;
      },
      set(val) {
        set(this.value, 'spec.underlay', val);
      },
    },

    vlanID: {
      get() {
        return this.value?.spec?.vlanID;
      },
      set(val) {
        set(this.value, 'spec.vlanID', val);
      },
    },

    clusterNetwork: {
      get() {
        return this.value?.spec?.clusterNetwork;
      },
      set(val) {
        set(this.value, 'spec.clusterNetwork', val);
      },
    },
  },

  watch: {
    networkMode(neu) {
      set(this.value, 'spec.mode', neu);

      if (neu !== MODE_STATIC) {
        if (this.value?.spec?.ips !== undefined) {
          delete this.value.spec.ips;
        }
        this.ips = {};

        if (this.value?.spec?.nodeSelector !== undefined) {
          delete this.value.spec.nodeSelector;
        }
        this.hasNodeSelector = false;
      }
    },
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  methods: {
    updateBeforeSave() {
      set(this.value, 'spec.mode', this.networkMode);

      if (this.isStaticMode) {
        set(this.value, 'spec.ips', { ...this.ips });
      }
    },

    updateIp(nodeName, val) {
      this.ips = { ...this.ips, [nodeName]: val };
    },

    addNodeSelector() {
      set(this.value.spec, 'nodeSelector', {
        matchExpressions: [{
          key: '', operator: 'In', values: []
        }]
      });
      this.hasNodeSelector = true;
    },

    removeNodeSelector() {
      delete this.value.spec.nodeSelector;
      this.hasNodeSelector = false;
    },
  },
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :mode="mode"
    :resource="value"
    :errors="errors"
    :apply-hooks="applyHooks"
    finish-button-mode="create"
    @finish="save"
    @cancel="done"
    @error="e => errors = e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      :namespaced="false"
      description-key="spec.description"
      @update:value="$emit('update:value', $event)"
    />

    <ResourceTabs
      class="mt-15"
      :need-conditions="false"
      :need-related="false"
      :need-events="false"
      :side-tabs="true"
      :mode="mode"
    >
      <Tab
        name="basic"
        :label="t('harvester.hostNetworkConfig.tabs.mode')"
        :weight="99"
        class="bordered-table"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <RadioGroup
              v-model:value="networkMode"
              name="hostNetworkConfigMode"
              :options="modeOptions"
              :mode="mode"
              :row="true"
            />
          </div>
        </div>

        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="clusterNetwork"
              :label="t('harvester.network.clusterNetwork.label')"
              :options="clusterNetworkOptions"
              :mode="mode"
              required
              :placeholder="t('harvester.network.clusterNetwork.selectPlaceholder')"
            />
          </div>
        </div>
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value.number="vlanID"
              type="number"
              required
              :min="2"
              :max="4094"
              placeholder="e.g. 2 ~ 4094"
              :label="t('harvester.hostNetworkConfig.vlanID.label')"
              :mode="mode"
            />
          </div>
        </div>

        <div class="row mb-20">
          <div class="col span-6">
            <Checkbox
              v-model:value="underlay"
              :label="t('harvester.hostNetworkConfig.underlay.label')"
              :tooltip="t('harvester.hostNetworkConfig.underlay.tooltip')"
              :mode="mode"
            />
          </div>
        </div>

        <template v-if="isStaticMode">
          <hr class="section-divider" />
          <div
            v-for="node in nodes"
            :key="node.id"
            class="row mb-10 ips-row"
          >
            <div class="col span-3">
              <LabeledInput
                :value="node.nameDisplay || node.id"
                :label="t('harvester.hostNetworkConfig.ips.nodeLabel')"
                mode="view"
                :disabled="true"
              />
            </div>
            <div class="col span-5">
              <LabeledInput
                :value="ips[node.id]"
                :label="t('harvester.hostNetworkConfig.ips.label')"
                :placeholder="t('harvester.hostNetworkConfig.ips.placeholder')"
                :mode="mode"
                required
                @update:value="updateIp(node.id, $event)"
              />
            </div>
          </div>
        </template>
      </Tab>
      <Tab
        v-if="isStaticMode"
        name="nodeSelector"
        :label="t('harvester.hostNetworkConfig.tabs.nodeSelector')"
        :weight="98"
      >
        <template v-if="hasNodeSelector">
          <InfoBox class="node-selector-box">
            <button
              v-if="!isView"
              type="button"
              class="role-link btn btn-sm remove"
              @click="removeNodeSelector"
            >
              <i class="icon icon-x" />
            </button>
            <HarvesterNodeSelector
              class="mt-20"
              :value="value.spec.nodeSelector"
              :mode="mode"
            />
          </InfoBox>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn role-secondary"
            @click="addNodeSelector"
          >
            {{ t('harvester.hostNetworkConfig.nodeSelector.addButton') }}
          </button>
        </template>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang="scss" scoped>
.section-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 10px 0 20px;
}

.node-selector-box {
  position: relative;

  .remove {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
    padding: 0;
  }
}
</style>
