<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { Checkbox } from '@components/Form/Checkbox';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { set } from '@shell/utils/object';
import { NODE } from '@shell/config/types';
import { HCI } from '../types';

const MODE_DHCP   = 'dhcp';
const MODE_STATIC = 'static';

export default {
  name: 'HarvesterHostNetworkConfigEditPage',

  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    ResourceTabs,
    Tab,
    LabeledSelect,
    LabeledInput,
    RadioGroup,
    Checkbox,
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
    const ips         = { ...(this.value?.spec?.ips || {}) };

    return {
      networkMode,
      ips,
    };
  },

  computed: {
    modeOptions() {
      return [
        { label: 'DHCP',   value: MODE_DHCP },
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

          <div class="ips-header row mb-10">
            <div class="col span-3">
              <label class="text-label">{{ t('harvester.hostNetworkConfig.ips.nodeLabel') }}</label>
            </div>
            <div class="col span-5">
              <label class="text-label">{{ t('harvester.hostNetworkConfig.ips.label') }}</label>
            </div>
          </div>
          <div
            v-for="node in nodes"
            :key="node.id"
            class="row mb-10 ips-row"
          >
            <div class="col span-3">
              <LabeledInput
                :value="node.nameDisplay || node.id"
                mode="view"
                :disabled="true"
              />
            </div>
            <div class="col span-5">
              <LabeledInput
                :value="ips[node.id]"
                :placeholder="t('harvester.hostNetworkConfig.ips.placeholder')"
                :mode="mode"
                @update:value="updateIp(node.id, $event)"
              />
            </div>
          </div>
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
</style>
