<script>
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import CruResource from '@shell/components/CruResource';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabeledSelect from '@shell/components/form/LabeledSelect';

import { HCI as HCI_LABELS_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../types';
import { NETWORK_TYPE } from '../config/types';

const { L2VLAN, UNTAGGED, OVERLAY } = NETWORK_TYPE;

const AUTO = 'auto';
const MANUAL = 'manual';

export default {
  emits: ['update:value'],

  components: {
    Tab,
    Tabbed,
    CruResource,
    LabeledInput,
    NameNsDescription,
    RadioGroup,
    LabeledSelect,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    }
  },

  data() {
    const config = JSON.parse(this.value.spec.config);

    const annotations = this.value?.metadata?.annotations || {};
    const layer3Network = JSON.parse(annotations[HCI_LABELS_ANNOTATIONS.NETWORK_ROUTE] || '{}');

    const type = this.value.vlanType || L2VLAN ;

    if ([L2VLAN, UNTAGGED].includes(type)) {
      if ((config.bridge || '').endsWith('-br')) {
        config.bridge = config.bridge.slice(0, -3);
      }
    }

    return {
      config,
      type,
      layer3Network: {
        mode:         layer3Network.mode || AUTO,
        serverIPAddr: layer3Network.serverIPAddr || '',
        cidr:         layer3Network.cidr || '',
        gateway:      layer3Network.gateway || '',
      },
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({ clusterNetworks: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.CLUSTER_NETWORK }) });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    modeOptions() {
      return [{
        label: this.t('harvester.network.layer3Network.mode.auto'),
        value: AUTO,
      }, {
        label: this.t('harvester.network.layer3Network.mode.manual'),
        value: MANUAL,
      }];
    },

    kubeovnVpcSubnetSupport() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('kubeovnVpcSubnet');
    },

    longhornV2LVMSupport() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('longhornV2LVMSupport');
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

    networkTypes() {
      const types = [L2VLAN, UNTAGGED];

      if (this.kubeovnVpcSubnetSupport) {
        types.push(OVERLAY);
      }

      return types;
    },

    isL2VlanNetwork() {
      if (this.isView) {
        return this.value.vlanType === L2VLAN;
      }

      return this.type === L2VLAN;
    },

    isOverlayNetwork() {
      if (this.isView) {
        return this.value.vlanType === OVERLAY;
      }

      return this.type === OVERLAY;
    },

    isUntaggedNetwork() {
      if (this.isView) {
        return this.value.vlanType === UNTAGGED;
      }

      return this.type === UNTAGGED;
    }
  },

  watch: {
    type(newType) {
      if (newType === OVERLAY) {
        this.config.type = 'kube-ovn';
        this.config.provider = `${ this.value.metadata.name }.${ this.value.metadata.namespace }.ovn`;
        this.config.server_socket = '/run/openvswitch/kube-ovn-daemon.sock';
      } else {
        this.config.type = 'bridge';
        this.config.promiscMode = true;
        this.config.ipam = {};
        delete this.config.provider;
      }
    }
  },

  methods: {
    async saveNetwork(buttonCb) {
      const errors = [];

      if (this.isL2VlanNetwork || this.isUntaggedNetwork) {
        if (!this.config.vlan && !this.isUntaggedNetwork) {
          errors.push(this.$store.getters['i18n/t']('validation.required', { key: this.t('tableHeaders.networkVlan') }));
        }

        if (!this.config.bridge) {
          errors.push(this.$store.getters['i18n/t']('validation.required', { key: this.t('harvester.network.clusterNetwork.label') }));
        }

        if (this.layer3Network.mode === MANUAL) {
          if (!this.layer3Network.gateway) {
            errors.push(this.$store.getters['i18n/t']('validation.required', { key: this.t('harvester.network.layer3Network.gateway.label') }));
          }
          if (!this.layer3Network.cidr) {
            errors.push(this.$store.getters['i18n/t']('validation.required', { key: this.t('harvester.network.layer3Network.cidr.label') }));
          }
        }

        if (errors.length > 0) {
          buttonCb(false);
          this.errors = errors;

          return false;
        }
        this.value.setAnnotation(HCI_LABELS_ANNOTATIONS.NETWORK_ROUTE, JSON.stringify(this.layer3Network));
      }

      await this.save(buttonCb);
    },

    input(neu) {
      if (neu === '') {
        this.config.vlan = '';

        return;
      }
      const newValue = Number(neu);

      if (newValue > 4094) {
        this.config.vlan = 4094;
      } else if (newValue < 1) {
        this.config.vlan = 1;
      } else {
        this.config.vlan = newValue;
      }
    },

    updateBeforeSave() {
      this.config.name = this.value.metadata.name;

      if (this.isOverlayNetwork) {
        this.config.provider = `${ this.value.metadata.name }.${ this.value.metadata.namespace }.ovn`;
        delete this.config.bridge;
        delete this.config.promiscMode;
        delete this.config.vlan;
        delete this.config.ipam;
      }

      if (this.isUntaggedNetwork) {
        delete this.config.vlan;
      }

      if (this.isL2VlanNetwork || this.isUntaggedNetwork) {
        this.config.bridge = `${ this.config.bridge }-br`;
      }

      this.value.spec.config = JSON.stringify({ ...this.config });
    },
  }
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="saveNetwork"
    @error="e=>errors=e"
  >
    <NameNsDescription
      ref="nd"
      :value="value"
      :mode="mode"
      @update:value="$emit('update:value', $event)"
    />
    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        name="basics"
        :label="t('harvester.network.tabs.basics')"
        :weight="99"
        class="bordered-table"
      >
        <LabeledSelect
          v-model:value="type"
          class="mb-20"
          :options="networkTypes"
          :mode="mode"
          :label="t('harvester.fields.type')"
          required
        />

        <LabeledInput
          v-if="isL2VlanNetwork"
          v-model:value.number="config.vlan"
          class="mb-20"
          required
          type="number"
          placeholder="e.g. 1-4094"
          :label="t('tableHeaders.networkVlan')"
          :mode="mode"
          @update:value="input"
        />
        <LabeledSelect
          v-if="!isOverlayNetwork"
          v-model:value="config.bridge"
          class="mb-20"
          :label="t('harvester.network.clusterNetwork.label')"
          required
          :options="clusterNetworkOptions"
          :mode="mode"
          :placeholder="t('harvester.network.clusterNetwork.selectPlaceholder')"
        />
      </Tab>
      <Tab
        v-if="isL2VlanNetwork"
        name="layer3Network"
        :label="t('harvester.network.tabs.layer3Network')"
        :weight="98"
        class="bordered-table"
      >
        <div class="row mt-10">
          <div class="col span-6">
            <RadioGroup
              v-model:value="layer3Network.mode"
              name="layer3NetworkMode"
              :label="t('harvester.network.layer3Network.mode.label')"
              :mode="mode"
              :options="modeOptions"
            />
          </div>
        </div>
        <div
          v-if="layer3Network.mode === 'auto'"
          class="row mt-10"
        >
          <div class="col span-6">
            <LabeledInput
              v-model:value="layer3Network.serverIPAddr"
              class="mb-20"
              :label="t('harvester.network.layer3Network.serverIPAddr.label')"
              :mode="mode"
            />
          </div>
        </div>
        <div
          v-else
          class="row mt-10"
        >
          <div class="col span-6">
            <LabeledInput
              v-model:value="layer3Network.cidr"
              class="mb-20"
              :label="t('harvester.network.layer3Network.cidr.label')"
              :placeholder="t('harvester.network.layer3Network.cidr.placeholder')"
              :mode="mode"
              required
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="layer3Network.gateway"
              class="mb-20"
              :label="t('harvester.network.layer3Network.gateway.label')"
              :placeholder="t('harvester.network.layer3Network.gateway.placeholder')"
              :mode="mode"
              required
            />
          </div>
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
