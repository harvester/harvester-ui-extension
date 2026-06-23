<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../types';

export default {
  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    ResourceTabs,
    Tab,
    LabeledInput,
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
    return {
      natGwDp:        this.value?.spec?.natGwDp || '',
      externalSubnet: this.value?.spec?.externalSubnet || '',
      v4ip:           this.value?.spec?.v4ip || '',
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      natGateways: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC_NAT_GATEWAY }),
      subnets:     this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
    });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    natGatewayOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const natGateways = this.$store.getters[`${ inStore }/all`](HCI.VPC_NAT_GATEWAY) || [];

      return natGateways.map((gw) => ({
        label: gw.id,
        value: gw.id,
      }));
    },

    subnetOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const subnets = this.$store.getters[`${ inStore }/all`](HCI.SUBNET) || [];

      return subnets.map((subnet) => ({
        label: subnet.id,
        value: subnet.id,
      }));
    },
  },

  methods: {
    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      this.value.spec.natGwDp = this.natGwDp;
      this.value.spec.externalSubnet = this.externalSubnet;
      this.value.spec.v4ip = this.v4ip;
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
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      ref="nd"
      :value="value"
      :mode="mode"
      :namespaced="false"
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
        label="Basic"
        :weight="99"
      >
        <div class="mt-20">
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="natGwDp"
                class="mb-20"
                :options="natGatewayOptions"
                :mode="mode"
                :label="t('harvester.externalIP.natGateway.label')"
                :placeholder="t('harvester.externalIP.natGateway.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="externalSubnet"
                class="mb-20"
                :options="subnetOptions"
                :label="t('harvester.externalIP.externalSubnet.label')"
                :placeholder="t('harvester.externalIP.externalSubnet.placeholder')"
                :mode="mode"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledInput
                v-model:value="v4ip"
                class="mb-20"
                :label="t('harvester.externalIP.v4ip.label')"
                :placeholder="t('harvester.externalIP.v4ip.placeholder')"
                :mode="mode"
                required
              />
            </div>
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
