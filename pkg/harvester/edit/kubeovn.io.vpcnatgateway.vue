<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import ArrayListSelect from '@shell/components/form/ArrayListSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { HCI as HCI_ANNOTATIONS } from '@pkg/config/labels-annotations';
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
    ArrayListSelect,
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
    const internalTenantNetwork = this.value?.metadata?.annotations?.[HCI_ANNOTATIONS.CNI_NETWORKS] || '';

    return {
      internalTenantNetwork,
      vpc:             this.value?.spec?.vpc || '',
      subnet:          this.value?.spec?.subnet || '',
      lanIp:           this.value?.spec?.lanIp || '',
      externalSubnets: this.value?.spec?.externalSubnets || [],
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      vpcs:       this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC }),
      subnets:    this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
      vmNetworks: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.NETWORK_ATTACHMENT }),
    });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    vpcOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vpcs = this.$store.getters[`${ inStore }/all`](HCI.VPC) || [];

      return vpcs.map((vpc) => ({
        label: vpc.id,
        value: vpc.id,
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

    vmNetworkOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vmNetworks = this.$store.getters[`${ inStore }/all`](HCI.NETWORK_ATTACHMENT) || [];

      return vmNetworks.map((network) => ({
        label: network.id,
        value: network.id,
      }));
    },
  },

  methods: {
    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      if (!this.value.metadata) {
        this.value.metadata = {};
      }

      if (!this.value.metadata.annotations) {
        this.value.metadata.annotations = {};
      }

      this.value.spec.vpc = this.vpc;
      this.value.spec.subnet = this.subnet;
      this.value.spec.lanIp = this.lanIp;
      this.value.spec.externalSubnets = (this.externalSubnets || []).filter((subnet) => !!subnet);

      if (this.internalTenantNetwork) {
        this.value.metadata.annotations[HCI_ANNOTATIONS.CNI_NETWORKS] = this.internalTenantNetwork;
      } else {
        delete this.value.metadata.annotations[HCI_ANNOTATIONS.CNI_NETWORKS];
      }
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
        :label="t('generic.basic')"
        :weight="99"
      >
        <div class="mt-20">
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="internalTenantNetwork"
                class="mb-20"
                required
                :options="vmNetworkOptions"
                :mode="mode"
                :label="t('harvester.natGateway.internalTenantNetwork.label')"
                :placeholder="t('harvester.natGateway.internalTenantNetwork.placeholder')"
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="vpc"
                class="mb-20"
                :options="vpcOptions"
                :mode="mode"
                :label="t('harvester.natGateway.vpc.label')"
                :placeholder="t('harvester.natGateway.vpc.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="subnet"
                class="mb-20"
                :options="subnetOptions"
                :mode="mode"
                :label="t('harvester.natGateway.subnet.label')"
                :placeholder="t('harvester.natGateway.subnet.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledInput
                v-model:value="lanIp"
                class="mb-20"
                :mode="mode"
                :label="t('harvester.natGateway.lanIp.label')"
                :placeholder="t('harvester.natGateway.lanIp.placeholder')"
                required
              />
            </div>
          </div>
        </div>
      </Tab>

      <Tab
        name="externalSubnets"
        :label="t('harvester.natGateway.externalSubnets.label')"
        :weight="98"
      >
        <div class="mt-20">
          <div class="row">
            <div class="col span-12">
              <ArrayListSelect
                v-model:value="externalSubnets"
                :mode="mode"
                :disabled="mode === 'view'"
                required
                :options="subnetOptions"
                :enable-default-add-value="false"
                :array-list-props="{
                  addLabel: t('harvester.natGateway.externalSubnets.addLabel'),
                  title: t('harvester.natGateway.subnet.label'),
                  initialEmptyRow: true,
                  required: true,
                  protip: false,
                }"
                :select-props="{
                  placeholder: t('harvester.natGateway.externalSubnets.placeholder'),
                  disabled: mode === 'view',
                }"
              />
            </div>
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
